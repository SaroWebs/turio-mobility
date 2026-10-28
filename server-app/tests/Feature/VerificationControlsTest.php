<?php

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\Role;
use App\Models\User;
use App\Services\DocumentVerification\EkoProvider;
use App\Services\Verification\DocumentWorkflow;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

function controlsAdmin(): User
{
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Administrator']);
    (new Database\Seeders\VerificationPermissionSeeder)->run();
    $user = User::create(['name' => 'Reviewer', 'email' => uniqid().'@example.com', 'password' => 'password']);
    $user->roles()->attach($role);

    return $user;
}

function controlsDocument(): DriverDocument
{
    Storage::fake('local');
    $driver = Driver::create(['name' => 'Applicant', 'date_of_birth' => '1990-01-01', 'phone' => '89'.random_int(10000000, 99999999), 'status' => 'pending']);

    return app(DocumentWorkflow::class)->submit($driver, ['type' => 'driving_license', 'document_number' => 'DL1234', 'expires_at' => today()->addYear()->toDateString()], \Illuminate\Http\UploadedFile::fake()->createWithContent('licence.pdf', '%PDF-1.4 test'));
}

function enableTestEko(): void
{
    config(['document_verification.eko' => ['enabled' => true, 'production' => false, 'developer_key' => 'test-developer', 'access_key' => 'test-access-key-123', 'initiator_id' => 'test-initiator']]);
    DB::table('verification_provider_settings')->insert(['provider' => 'eko', 'enabled' => true, 'authorization_reference' => 'TEST', 'created_at' => now(), 'updated_at' => now()]);
    Http::preventStrayRequests();
}

it('resumes the controls migration after an index failure without dropping existing data', function () {
    $document = controlsDocument();
    $finding = \App\Models\VerificationFinding::create(['driver_document_id' => $document->id, 'version' => 1, 'code' => 'test', 'severity' => 'warning', 'message' => 'Preserve this finding', 'created_at' => now()]);
    \Illuminate\Support\Facades\Schema::table('verification_findings', fn ($table) => $table->dropIndex('vf_document_version_resolved_idx'));
    $migration = require database_path('migrations/2026_10_18_000004_complete_verification_controls.php');
    $migration->up();
    $migration->up();
    expect(\Illuminate\Support\Facades\Schema::hasIndex('verification_findings', 'vf_document_version_resolved_idx'))->toBeTrue();
    expect($finding->fresh()->message)->toBe('Preserve this finding');
    expect($document->fresh()->version)->toBe(1);
});

it('signs Eko requests and retains normalized evidence without approving the driver', function () {
    $document = controlsDocument();
    $admin = controlsAdmin();
    enableTestEko();
    expect(EkoProvider::signature('test-access-key-123', '1700000000000'))->toBe('88lqTf9ew69XbVbeczjxVL8/B4vibfp1MvTi1mIj2Xo=');
    Http::fake(['*' => Http::response(['status' => 0, 'data' => ['dl_number' => 'DL1234', 'dob' => '1990-01-01', 'status' => 'Active', 'details_of_driving_licence' => ['name' => 'Applicant', 'cov_details' => [['cov' => 'LMV']]], 'dl_validity' => ['non_transport' => ['to' => today()->addYear()->toDateString()]]]])]);
    $attempt = app(\App\Services\DocumentVerification\DocumentVerifier::class)->verify($document, 'eko', $admin->id);
    expect($document->fresh()->status)->toBe('api_verified')->and($attempt->attributes['name'])->toBe('Applicant');
    expect($attempt->toArray())->not->toHaveKey('attributes');
    expect($attempt->getRawOriginal('attributes'))->not->toContain('Applicant');
    Http::assertSent(fn ($request) => $request['dl_number'] === 'DL1234' && $request['dob'] === '1990-01-01' && strlen($request['client_ref_id']) === 20 && $request->hasHeader('developer_key', 'test-developer'));
});

it('keeps malformed and timed out provider responses inconclusive without retries', function () {
    $document = controlsDocument();
    enableTestEko();
    Http::fake(['*' => Http::response(['status' => 0, 'data' => ['dl_number' => ['bad']]])]);
    $result = app(EkoProvider::class)->verify($document, (string) \Illuminate\Support\Str::uuid());
    expect($result->status)->toBe('inconclusive')->and($result->errorCode)->toBe('invalid_schema');
    Http::fake(['*' => Http::failedConnection()]);
    $result = app(EkoProvider::class)->verify($document, (string) \Illuminate\Support\Str::uuid());
    expect($result->status)->toBe('error')->and($result->errorCode)->toBe('timeout')->and($result->chargeable)->toBeNull();
});

it('never repeats a provider call when the same queued request is delivered again', function () {
    $document = controlsDocument();
    $admin = controlsAdmin();
    enableTestEko();
    Http::fake(['*' => Http::response(['status' => 1])]);
    $job = new \App\Jobs\VerifyDriverDocument($document->id, 1, 'eko', $admin->id);
    $job->handle(app(\App\Services\DocumentVerification\DocumentVerifier::class));
    $job->handle(app(\App\Services\DocumentVerification\DocumentVerifier::class));
    Http::assertSentCount(1);
    expect($document->verificationAttempts()->count())->toBe(1);
});

it('requires independent senior approval and blocks confirmed invalid evidence', function () {
    $document = controlsDocument();
    $first = controlsAdmin();
    $second = controlsAdmin();
    $document->update(['requires_second_review' => true]);
    $workflow = app(DocumentWorkflow::class);
    $workflow->decide($document, $first, ['version' => 1, 'action' => 'manually_verified', 'reason' => 'Checked', 'evidence' => ['source' => 'Registry', 'method' => 'Authorized check', 'checked_at' => now()->toIso8601String(), 'reference' => 'ABC', 'findings' => 'Valid licence, identity and classes match']]);
    $decision = ['version' => 1, 'action' => 'approved', 'reason' => 'Evidence reviewed'];
    $workflow->decide($document, $first, $decision);
    expect($document->fresh()->status)->toBe('manually_verified');
    expect(fn () => $workflow->decide($document, $first, $decision))->toThrow(ValidationException::class);
    $workflow->decide($document, $second, $decision);
    expect($document->fresh()->status)->toBe('approved');
    $document->update(['status' => 'inconclusive']);
    app(\App\Services\Verification\VerificationMatching::class)->record($document, ['valid' => false], null);
    $finding = \App\Models\VerificationFinding::firstOrFail();
    $this->actingAs($first)->post('/admin/verification/findings/'.$finding->id.'/resolve', ['source' => 'Override', 'reference' => 'X', 'findings' => 'Override'])->assertUnprocessable();
    expect(app(\App\Services\Verification\VerificationMatching::class)->blocked($document))->toBeTrue();
});

it('purges only superseded private files and respects holds and pending appeals', function () {
    $document = controlsDocument();
    $admin = controlsAdmin();
    $old = $document->versions()->first();
    DB::table('driver_document_versions')->where('id', $old->id)->update(['created_at' => now()->subDays(100), 'legal_hold' => true]);
    app(DocumentWorkflow::class)->decide($document, $admin, ['version' => 1, 'action' => 'correction_required', 'reason' => 'Replace']);
    app(DocumentWorkflow::class)->submit($document->driver, ['type' => 'driving_license', 'document_number' => 'DL1234'], \Illuminate\Http\UploadedFile::fake()->createWithContent('replacement.pdf', '%PDF-1.4 corrected'));
    config(['document_verification.retention_days' => 30]);
    $this->artisan('verification:retention', ['--execute' => true])->assertSuccessful();
    Storage::disk('local')->assertExists($old->file_path);
    DB::table('driver_document_versions')->where('id', $old->id)->update(['legal_hold' => false]);
    DB::table('verification_appeals')->insert(['driver_document_id' => $document->id, 'version' => 1, 'reason' => 'Pending review', 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
    $this->artisan('verification:retention', ['--execute' => true])->assertSuccessful();
    Storage::disk('local')->assertExists($old->file_path);
    DB::table('verification_appeals')->where('driver_document_id', $document->id)->update(['status' => 'upheld']);
    $this->artisan('verification:retention')->assertSuccessful();
    Storage::disk('local')->assertExists($old->file_path);
    $this->artisan('verification:retention', ['--execute' => true])->assertSuccessful();
    Storage::disk('local')->assertMissing($old->file_path);
    expect($old->fresh()->purged_at)->not->toBeNull();
    Storage::disk('local')->assertExists($document->fresh()->file_path);
});

it('rejects approval when identity changes after a manual check', function () {
    $document = controlsDocument();
    $admin = controlsAdmin();
    $workflow = app(DocumentWorkflow::class);
    $workflow->decide($document, $admin, ['version' => 1, 'action' => 'manually_verified', 'reason' => 'Checked', 'evidence' => ['method' => 'External', 'source' => 'Registry', 'checked_at' => now()->toIso8601String(), 'reference' => 'X', 'findings' => 'Matched']]);
    $document->driver->update(['name' => 'Changed identity']);
    expect(fn () => $workflow->decide($document, $admin, ['version' => 1, 'action' => 'approved', 'reason' => 'Approve']))->toThrow(ValidationException::class);
});

it('records a request before queue execution and prevents duplicate reservations', function () {
    $document = controlsDocument();
    $admin = controlsAdmin();
    enableTestEko();
    Http::fake(['*' => Http::response(['status' => 1])]);
    $verifier = app(\App\Services\DocumentVerification\DocumentVerifier::class);
    $attempt = $verifier->reserve($document, 'eko', $admin->id, 1);
    expect($attempt->status)->toBe('queued');
    Http::assertNothingSent();
    expect(fn () => $verifier->reserve($document, 'eko', $admin->id, 1))->toThrow(ValidationException::class);
    $job = new \App\Jobs\VerifyDriverDocument($document->id, 1, 'eko', $admin->id);
    $job->requestId = $attempt->request_id;
    $job->handle($verifier);
    $job->handle($verifier);
    Http::assertSentCount(1);
    expect($attempt->fresh()->status)->toBe('inconclusive');
});

it('privatizes historical versions and can remove originals on a later run', function () {
    $document = controlsDocument();
    Storage::fake('public');
    $path = 'driver-documents/'.$document->driver_id.'/historical.pdf';
    Storage::disk('public')->put($path, '%PDF-1.4 old');
    $version = $document->versions()->first();
    DB::table('driver_document_versions')->where('id', $version->id)->update(['file_path' => $path, 'storage_disk' => 'public', 'checksum' => hash('sha256', '%PDF-1.4 old')]);
    $this->artisan('verification:privatize', ['--execute' => true])->assertSuccessful();
    Storage::disk('public')->assertExists($path);
    expect($version->fresh()->storage_disk)->toBe('local');
    $this->artisan('verification:privatize', ['--execute' => true, '--remove-public' => true])->assertSuccessful();
    Storage::disk('public')->assertMissing($path);
    Storage::disk('local')->assertExists($version->fresh()->file_path);
    expect(DB::table('verification_file_moves')->whereNull('source_removed_at')->count())->toBe(0);
});

it('accepts an approved identity alternative and invalidates it when profile details change', function () {
    $document = controlsDocument();
    $document->update(['type' => 'passport']);
    $driver = $document->driver;
    $driver->update(['status' => 'active', 'is_active' => true, 'is_approved' => true]);
    \App\Models\DocumentRequirement::create(['type' => 'government_id', 'label' => 'Identity', 'service_category' => 'short_ride', 'level' => 'identity', 'enabled' => true, 'alternative_types' => ['passport']]);
    DB::table('driver_verification_cases')->insert(['driver_id' => $driver->id, 'service_category' => 'short_ride', 'status' => 'approved', 'created_at' => now(), 'updated_at' => now()]);
    $admin = controlsAdmin();
    $workflow = app(DocumentWorkflow::class);
    $workflow->decide($document, $admin, ['version' => 1, 'action' => 'manually_verified', 'reason' => 'Checked', 'evidence' => ['method' => 'External', 'source' => 'Registry', 'checked_at' => now()->toIso8601String(), 'reference' => 'X', 'findings' => 'Matched']]);
    $workflow->decide($document, $admin, ['version' => 1, 'action' => 'approved', 'reason' => 'Reviewed']);
    expect(app(\App\Services\DriverEligibilityService::class)->evaluate($driver, 'short_ride')['eligible'])->toBeTrue();
    expect(app(\App\Services\DriverVerificationService::class)->summary($driver)['is_complete'])->toBeTrue();
    $driver->update(['name' => 'Changed']);
    expect(app(\App\Services\DriverEligibilityService::class)->evaluate($driver, 'short_ride')['eligible'])->toBeFalse();
});

it('keeps provider configuration and notices scoped to authorized actors', function () {
    $document = controlsDocument();
    $admin = controlsAdmin();
    $this->actingAs($admin)->post('/admin/verification/providers', ['enabled' => true, 'authorization_reference' => 'TEST', 'reason' => 'Configure'])->assertUnprocessable();
    \Laravel\Sanctum\Sanctum::actingAs($document->driver);
    $id = DB::table('verification_notices')->where('driver_id', $document->driver_id)->value('id');
    $this->postJson('/api/driver-app/verification-notices/'.$id.'/read')->assertOk();
    $other = Driver::create(['name' => 'Other', 'phone' => '89'.random_int(10000000, 99999999)]);
    \Laravel\Sanctum\Sanctum::actingAs($other);
    $this->postJson('/api/driver-app/verification-notices/'.$id.'/read')->assertNotFound();
});

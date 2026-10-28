<?php

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\Role;
use App\Models\User;
use App\Models\VerificationReview;
use App\Services\Verification\DocumentWorkflow;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

function workflowAdmin(): User
{
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Administrator']);
    (new Database\Seeders\VerificationPermissionSeeder)->run();
    $user = User::create(['name' => 'Reviewer', 'email' => uniqid().'@example.com', 'password' => 'password']);
    $user->roles()->attach($role);

    return $user;
}

function workflowDriver(): Driver
{
    return Driver::create(['name' => 'Applicant', 'phone' => '89'.random_int(10000000, 99999999), 'status' => 'pending']);
}

function workflowUpload(Driver $driver, string $contents = 'first'): DriverDocument
{
    return app(DocumentWorkflow::class)->submit($driver, ['type' => 'driving_license', 'document_number' => 'PRIVATE-1234', 'expires_at' => today()->addYear()->toDateString()], UploadedFile::fake()->createWithContent('licence.pdf', '%PDF-1.4 '.$contents));
}

it('stores private immutable versions and hides sensitive identifiers', function () {
    Storage::fake('local');
    $document = workflowUpload(workflowDriver());
    Storage::disk('local')->assertExists($document->file_path);
    expect($document->getRawOriginal('encrypted_number'))->not->toContain('PRIVATE-1234');
    expect($document->toArray())->not->toHaveKeys(['file_path', 'document_number', 'encrypted_number']);
    expect($document->masked_number)->toBe('****1234')->and($document->file_url)->toBeNull();
    $version = $document->versions()->first();
    expect(fn () => $version->update(['file_path' => 'changed']))->toThrow(LogicException::class);
});

it('requires evidence and a separate human approval for the current version', function () {
    Storage::fake('local');
    $document = workflowUpload(workflowDriver());
    $admin = workflowAdmin();
    $workflow = app(DocumentWorkflow::class);
    expect(fn () => $workflow->decide($document, $admin, ['version' => 1, 'action' => 'approved', 'reason' => 'Approve']))->toThrow(ValidationException::class);
    expect(fn () => $workflow->decide($document, $admin, ['version' => 1, 'action' => 'manually_verified', 'reason' => 'Checked']))->toThrow(ValidationException::class);
    $workflow->decide($document, $admin, ['version' => 1, 'action' => 'manually_verified', 'reason' => 'Checked source', 'evidence' => [
        'method' => 'Authorized external check', 'source' => 'Authorized registry', 'checked_at' => now()->toIso8601String(), 'findings' => 'Identity and licence class match; current licence.', 'reference' => 'CHECK-1',
    ]]);
    expect($document->fresh()->status)->toBe('manually_verified');
    $workflow->decide($document, $admin, ['version' => 1, 'action' => 'approved', 'reason' => 'Evidence reviewed']);
    expect($document->fresh()->status)->toBe('approved');
    expect(fn () => $workflow->decide($document, $admin, ['version' => 1, 'action' => 'approved', 'reason' => 'Duplicate decision']))->toThrow(ValidationException::class);
});

it('enforces independent attempt limits and rejects stale reviews and duplicate files', function () {
    Storage::fake('local');
    $driver = workflowDriver();
    $document = workflowUpload($driver);
    $admin = workflowAdmin();
    $workflow = app(DocumentWorkflow::class);
    expect(fn () => workflowUpload($driver, 'blocked'))->toThrow(ValidationException::class);
    foreach ([1, 2] as $version) {
        $workflow->decide($document->fresh(), $admin, ['version' => $version, 'action' => 'correction_required', 'reason' => 'Provide clearer evidence']);
        expect(fn () => workflowUpload($driver))->toThrow(ValidationException::class);
        $document = workflowUpload($driver, 'replacement-'.$version);
    }
    expect($document->versions()->count())->toBe(3);
    expect(fn () => $workflow->decide($document, $admin, ['version' => 2, 'action' => 'rejected', 'reason' => 'Stale review']))->toThrow(ValidationException::class);
    $workflow->decide($document, $admin, ['version' => 3, 'action' => 'correction_required', 'reason' => 'Correction']);
    expect(fn () => workflowUpload($driver, 'fourth'))->toThrow(ValidationException::class);
    $workflow->decide($document->fresh(), $admin, ['version' => 3, 'action' => 'reopen', 'reason' => 'Appeal accepted; another submission authorized']);
    expect(workflowUpload($driver, 'fourth')->version)->toBe(4);
});

it('binds signed previews to the authorized admin and audits access', function () {
    Storage::fake('local');
    $document = workflowUpload(workflowDriver());
    $admin = workflowAdmin();
    $version = $document->versions()->first();
    $url = URL::temporarySignedRoute('admin.verification.preview', now()->addMinutes(5), ['version' => $version->id, 'actor' => $admin->id]);
    $this->actingAs($admin)->get($url)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
    expect(VerificationReview::where('action', 'preview')->count())->toBe(1);
    $this->actingAs(workflowAdmin())->get($url)->assertForbidden();
    $this->actingAs($admin)->get($url.'tampered')->assertForbidden();
    $this->travel(6)->minutes();
    $this->get($url)->assertForbidden();
});

it('rejects unauthorized decisions and cross-driver appeals', function () {
    Storage::fake('local');
    $document = workflowUpload(workflowDriver());
    $admin = workflowAdmin();
    $admin->roles->first()->permissions()->detach();
    $admin->unsetRelation('roles');
    $this->actingAs($admin)->postJson('/admin/verification/documents/'.$document->id.'/decision', ['version' => 1, 'action' => 'rejected', 'reason' => 'Invalid'])->assertForbidden();
    Sanctum::actingAs(workflowDriver());
    $this->postJson('/api/driver-app/documents/'.$document->id.'/appeal', ['reason' => 'Please review'])->assertNotFound();
});

it('expires current documents and deduplicates expiration notices', function () {
    Storage::fake('local');
    $document = workflowUpload(workflowDriver());
    $document->update(['status' => 'approved', 'expires_at' => today()->subDay()]);
    $this->artisan('verification:monitor-expiry')->assertSuccessful();
    $this->artisan('verification:monitor-expiry')->assertSuccessful();
    expect($document->fresh()->status)->toBe('expired');
    expect(VerificationReview::where('action', 'expired')->count())->toBe(1);
});

it('requires upload consent and rejects unsafe file types without consuming attempts', function () {
    Storage::fake('local');
    $driver = workflowDriver();
    Sanctum::actingAs($driver);
    $this->postJson('/api/driver-app/documents', ['type' => 'driving_license', 'file' => UploadedFile::fake()->create('test.pdf', 5, 'application/pdf')])->assertUnprocessable()->assertJsonValidationErrors('consent');
    $this->postJson('/api/driver-app/documents', ['type' => 'driving_license', 'consent' => true, 'file' => UploadedFile::fake()->create('test.exe', 5)])->assertUnprocessable()->assertJsonValidationErrors('file');
    expect($driver->documents()->count())->toBe(0);
});

it('enforces per-service eligibility and expiration even without the scheduler', function () {
    Storage::fake('local');
    $driver = workflowDriver();
    $driver->update(['status' => 'active', 'is_active' => true, 'is_approved' => true]);
    $document = workflowUpload($driver);
    $document->update(['status' => 'approved', 'verification_outcome' => 'verified']);
    App\Models\DocumentRequirement::create(['type' => 'driving_license', 'label' => 'Licence', 'service_category' => 'short_ride', 'level' => 'driving', 'requires_expiry' => true, 'enabled' => true]);
    $admin = workflowAdmin();
    $approval = app(App\Services\Verification\ServiceApproval::class);
    $approval->decide($driver, $admin, ['service' => 'short_ride', 'status' => 'under_review', 'reason' => 'Reviewed policy enrollment']);
    $eligibility = app(App\Services\DriverEligibilityService::class);
    expect($eligibility->evaluate($driver, 'short_ride')['eligible'])->toBeFalse();
    $approval->decide($driver, $admin, ['service' => 'short_ride', 'status' => 'approved', 'reason' => 'All required evidence approved']);
    expect($eligibility->evaluate($driver, 'short_ride')['eligible'])->toBeTrue();
    $document->update(['expires_at' => today()->subDay()]);
    expect($eligibility->evaluate($driver, 'short_ride')['eligible'])->toBeFalse();
    expect($eligibility->evaluate($driver, 'rental')['managed'])->toBeFalse();
    expect(fn () => $approval->decide($driver, $admin, ['service' => 'short_ride', 'status' => 'approved', 'reason' => 'Cannot override expiry']))->toThrow(ValidationException::class);
});

it('locks published requirements against weakening and audits policy publication', function () {
    $admin = workflowAdmin();
    $payload = ['type' => 'driving_license', 'label' => 'Driving licence', 'service_category' => 'short_ride', 'level' => 'driving', 'mandatory' => true, 'blocks_activation' => true, 'requires_expiry' => true, 'verification_method' => 'manual', 'max_submissions' => 3, 'enabled' => true, 'reason' => 'Compliance review reference POLICY-1'];
    $this->actingAs($admin)->post('/admin/verification/requirements', $payload)->assertRedirect();
    $this->postJson('/admin/verification/requirements', [...$payload, 'enabled' => false])->assertUnprocessable();
    $this->assertDatabaseHas('verification_policy_events', ['action' => 'requirement_published']);
});

it('resolves appeals without approving documents and prevents replayed decisions', function () {
    Storage::fake('local');
    $driver = workflowDriver();
    $document = workflowUpload($driver);
    $admin = workflowAdmin();
    app(DocumentWorkflow::class)->decide($document, $admin, ['version' => 1, 'action' => 'rejected', 'reason' => 'Unclear scan']);
    Sanctum::actingAs($driver);
    $this->postJson('/api/driver-app/documents/'.$document->id.'/appeal', ['reason' => 'I have a clearer original'])->assertOk();
    $appeal = Illuminate\Support\Facades\DB::table('verification_appeals')->first();
    $this->actingAs($admin, 'web')->post('/admin/verification/appeals/'.$appeal->id.'/resolve', ['decision' => 'reopen', 'resolution' => 'Replacement authorized'])->assertRedirect();
    expect($document->fresh()->status)->toBe('correction_required');
    $this->postJson('/admin/verification/appeals/'.$appeal->id.'/resolve', ['decision' => 'reopen', 'resolution' => 'Replay'])->assertUnprocessable();
});

it('only migrates legacy public files when explicitly executed and verifies the private copy', function () {
    Storage::fake('public');
    Storage::fake('local');
    $driver = workflowDriver();
    $path = 'driver-documents/'.$driver->id.'/legacy.pdf';
    Storage::disk('public')->put($path, "%PDF-1.4\nLegacy document");
    $document = DriverDocument::create(['driver_id' => $driver->id, 'type' => 'driving_license', 'status' => 'approved', 'file_path' => $path, 'document_number' => 'LEGACY-1234']);
    $this->artisan('verification:privatize')->assertSuccessful();
    expect($document->fresh()->storage_disk)->toBe('public');
    $this->artisan('verification:privatize --execute --remove-public')->assertSuccessful();
    $current = $document->fresh();
    expect($current->storage_disk)->toBe('local')->and($current->status)->toBe('pending')->and($current->document_number)->toBeNull();
    Storage::disk('public')->assertMissing($path);
    Storage::disk('local')->assertExists($current->file_path);
    expect($current->versions()->count())->toBe(1);
});

it('queues checks with no automatic retries and leaves simulation results as evidence only', function () {
    Storage::fake('local');
    $document = workflowUpload(workflowDriver());
    $admin = workflowAdmin();
    $job = new App\Jobs\VerifyDriverDocument($document->id, $document->version, 'simulated_transport', $admin->id);
    expect($job->tries)->toBe(1);
    $job->handle(app(App\Services\DocumentVerification\DocumentVerifier::class));
    expect($document->fresh()->status)->toBe('pending');
    $attempt = $document->verificationAttempts()->first();
    expect($attempt->cost_minor)->toBe(0)->and($attempt->duration_ms)->not->toBeNull();
    $this->withoutVite()->actingAs($admin)->get('/admin/verification/analytics')->assertOk();
});

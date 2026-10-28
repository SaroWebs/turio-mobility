<?php

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\Role;
use App\Models\User;
use App\Services\DocumentVerification\DocumentVerifier;
use App\Services\DocumentVerification\VerificationProvider;
use App\Services\DocumentVerification\VerificationResult;
use App\Services\DriverVerificationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

function providerAdmin(): User
{
    $admin = User::create(['name' => 'Reviewer', 'email' => uniqid().'@example.com', 'password' => 'password']);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Administrator']);
    (new Database\Seeders\VerificationPermissionSeeder)->run();
    $admin->roles()->syncWithoutDetaching([$role->id]);

    return $admin;
}

function providerDocument(string $type = 'vehicle_rc'): DriverDocument
{
    $driver = Driver::create(['name' => 'Applicant', 'phone' => '81'.random_int(10000000, 99999999), 'status' => 'pending', 'is_approved' => false]);

    return DriverDocument::create(['driver_id' => $driver->id, 'type' => $type, 'file_path' => 'test/current.pdf', 'status' => 'pending']);
}

it('requires RC and allows missing or rejected police verification', function () {
    $document = providerDocument();
    $driver = $document->driver;
    foreach (['driving_license', 'government_id'] as $type) {
        DriverDocument::create(['driver_id' => $driver->id, 'type' => $type, 'file_path' => 'test.pdf', 'status' => 'approved']);
    }
    expect(app(DriverVerificationService::class)->summary($driver)['missing_or_unverified'])->toBe(['vehicle_rc']);
    $document->update(['status' => 'approved']);
    expect(app(DriverVerificationService::class)->summary($driver)['is_complete'])->toBeTrue();
    DriverDocument::create(['driver_id' => $driver->id, 'type' => 'police_verification', 'file_path' => 'police.pdf', 'status' => 'rejected']);
    expect(app(DriverVerificationService::class)->summary($driver)['is_complete'])->toBeTrue();
});

it('records simulated outcomes and leaves provider errors retryable', function (string $outcome, string $status) {
    $document = providerDocument();
    $admin = providerAdmin();
    $this->actingAs($admin)->post("/admin/drivers/{$document->driver_id}/documents/{$document->id}/verify", [
        'provider' => 'simulated_transport', 'outcome' => $outcome,
    ])->assertRedirect()->assertSessionHasNoErrors();
    expect($document->fresh()->status)->toBe($status);
    $attempt = $document->verificationAttempts()->first();
    expect($attempt->status)->toBe($outcome)->and($attempt->simulated)->toBeTrue()
        ->and($attempt->requested_by)->toBe($admin->id)->and($attempt->reference)->toStartWith('SIM-');
})->with([['approved', 'pending'], ['rejected', 'pending'], ['error', 'pending']]);

it('rejects incompatible providers, expired documents and direct approval', function () {
    $document = providerDocument();
    $this->actingAs(providerAdmin());
    $url = "/admin/drivers/{$document->driver_id}/documents/{$document->id}";
    $this->post($url.'/verify', ['provider' => 'simulated_identity'])->assertSessionHasErrors('provider');
    $this->put($url, ['status' => 'approved'])->assertSessionHasErrors('status');
    $document->update(['expires_at' => today()->subDay()]);
    $this->post($url.'/verify', ['provider' => 'simulated_transport'])->assertSessionHasErrors('document');
    expect($document->verificationAttempts()->count())->toBe(0);
});

it('restricts verification to admins and the correct driver', function () {
    $document = providerDocument();
    $url = "/admin/drivers/{$document->driver_id}/documents/{$document->id}/verify";
    $this->post($url, ['provider' => 'simulated_transport'])->assertRedirect('/login');
    $other = providerDocument();
    $this->actingAs(providerAdmin())->post("/admin/drivers/{$other->driver_id}/documents/{$document->id}/verify", ['provider' => 'simulated_transport'])->assertNotFound();
    expect($document->verificationAttempts()->count())->toBe(0);
});

it('does not apply a provider response to a replacement upload', function () {
    $document = providerDocument();
    config(['document_verification.providers.test' => ['adapter' => 'test.document.provider', 'simulated' => false],
        'document_verification.types.vehicle_rc' => ['test']]);
    app()->instance('test.document.provider', new class implements VerificationProvider
    {
        public function verify(DriverDocument $document, string $requestId, array $options = []): VerificationResult
        {
            DriverDocument::whereKey($document->id)->update(['file_path' => 'test/replacement.pdf']);

            return new VerificationResult('approved', $requestId, 'Passed');
        }
    });
    $attempt = app(DocumentVerifier::class)->verify($document, 'test', providerAdmin()->id);
    expect($attempt->status)->toBe('superseded')->and($document->fresh()->status)->toBe('pending');
});

it('accepts RC uploads and resets approval without deleting attempt history', function () {
    Storage::fake('local');
    $document = providerDocument();
    app(DocumentVerifier::class)->verify($document, 'simulated_transport', providerAdmin()->id);
    app(\App\Services\Verification\DocumentWorkflow::class)->decide($document, providerAdmin(), ['version' => 0, 'action' => 'correction_required', 'reason' => 'Submit a clearer RC']);
    Sanctum::actingAs($document->driver);
    $this->post('/api/driver-app/documents', ['type' => 'vehicle_rc', 'consent' => true, 'expires_at' => today()->addYear()->toDateString(),
        'file' => UploadedFile::fake()->create('rc.pdf', 100, 'application/pdf')])->assertOk()->assertJsonPath('data.status', 'pending');
    expect($document->verificationAttempts()->count())->toBe(1);
});

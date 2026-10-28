<?php

use App\Models\CarCategory;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\DriverDocument;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\DriverVerificationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

function onboardingDriver(): Driver
{
    return Driver::create([
        'name' => 'Setup Driver', 'phone' => '83'.random_int(10000000, 99999999),
        'status' => 'active', 'is_active' => true, 'is_approved' => true, 'can_rental_delivery' => true,
    ]);
}

function onboardingDocuments(Driver $driver, string $status = 'approved'): void
{
    foreach (['driving_license', 'government_id', 'vehicle_rc'] as $type) {
        DriverDocument::create([
            'driver_id' => $driver->id, 'type' => $type, 'status' => $status,
            'file_path' => "test/{$type}.pdf",
        ]);
    }
}

function onboardingVehicle(Driver $driver): Vehicle
{
    $category = CarCategory::create([
        'name' => 'Onboarding sedan', 'slug' => 'setup-'.uniqid(), 'vehicle_type' => 'sedan',
        'seats' => 4, 'base_price_per_day' => 1000, 'is_active' => true,
    ]);

    return Vehicle::create([
        'driver_id' => $driver->id, 'car_category_id' => $category->id,
        'registration_number' => 'KA01AB1234', 'make' => 'Toyota', 'model' => 'Etios',
        'year' => 2024, 'color' => 'White', 'fuel_type' => 'petrol', 'seats' => 4, 'is_ac' => true,
        'approval_status' => 'approved', 'is_active' => true, 'condition' => 'good',
    ]);
}

it('allows a pending driver to submit a car before uploading documents', function () {
    $driver = onboardingDriver();
    $driver->update(['status' => 'pending', 'is_approved' => false]);
    $category = CarCategory::create(['name' => 'Sedan', 'slug' => 'pending-sedan', 'vehicle_type' => 'sedan', 'seats' => 4, 'base_price_per_day' => 1000, 'is_active' => true]);
    Sanctum::actingAs($driver);
    $this->putJson('/api/driver-app/vehicle', [
        'car_category_id' => $category->id, 'registration_number' => 'ka 01 ab 9876',
        'make' => 'Toyota', 'model' => 'Etios', 'year' => 2024, 'color' => 'White',
        'fuel_type' => 'petrol', 'seats' => 4, 'is_ac' => true,
    ])->assertOk()->assertJsonPath('vehicle.approval_status', 'pending')
        ->assertJsonPath('vehicle.registration_number', 'KA01AB9876')
        ->assertJsonPath('vehicle_readiness.can_go_online', false);
    expect($driver->vehicle()->count())->toBe(1);
});

it('creates a resumable account without asking for licence and car twice', function () {
    $phone = '8300000001';
    $token = Crypt::encryptString(json_encode(['phone' => $phone, 'expires_at' => now()->addMinutes(15)->timestamp]));

    $this->postJson('/api/driver-app/otp/register-complete', [
        'phone' => $phone, 'registration_token' => $token, 'name' => 'New Driver', 'service_types' => ['ride'],
    ])->assertCreated()->assertJsonPath('driver.is_approved', false)->assertJsonPath('driver.status', 'pending');

    expect(Driver::where('phone', $phone)->first()->vehicle)->toBeNull();
});

it('does not turn submitted documents into requests to upload them again', function () {
    $driver = onboardingDriver();
    $driver->wallet()->create(['balance' => 100, 'balance_minor' => 10000, 'currency' => 'INR', 'is_active' => true]);
    onboardingDocuments($driver, 'pending');
    onboardingVehicle($driver);
    Sanctum::actingAs($driver);

    $this->getJson('/api/driver-app/documents')->assertOk()
        ->assertJsonPath('verification.status', 'in_review')
        ->assertJsonPath('verification.next_document', null)
        ->assertJsonPath('verification.approved_count', 0);
    $this->putJson('/api/driver-app/availability', ['is_online' => true, 'is_available' => true])
        ->assertUnprocessable()->assertJsonPath('vehicle_readiness.status', 'documents_pending');
});

it('prioritizes corrections and treats expiry as a server derived status', function () {
    $driver = onboardingDriver();
    onboardingDocuments($driver);
    $driver->documents()->where('type', 'driving_license')->update(['expires_at' => today()->subDay()]);
    $driver->documents()->where('type', 'vehicle_rc')->update(['status' => 'rejected', 'rejection_reason' => 'Unreadable']);
    $summary = app(DriverVerificationService::class)->summary($driver);

    expect($summary['status'])->toBe('action_required')
        ->and($summary['next_document'])->toBe('vehicle_rc')
        ->and($summary['requirements'][0]['status'])->toBe('expired')
        ->and($summary['approved_count'])->toBe(1);
});

it('accepts expiry through the current date and does not require optional PAN', function () {
    $driver = onboardingDriver();
    onboardingDocuments($driver);
    $driver->documents()->update(['expires_at' => today()]);

    expect(app(DriverVerificationService::class)->summary($driver)['is_complete'])->toBeTrue();
    $vehicle = onboardingVehicle($driver);
    $vehicle->update(['insurance_expiry' => today(), 'permit_expiry' => today(), 'fitness_expiry' => today(), 'pollution_expiry' => today()]);
    expect($vehicle->fresh()->isDocumentValid())->toBeTrue();
    $vehicle->update(['insurance_expiry' => today()->subDay()]);
    expect($vehicle->fresh()->isDocumentValid())->toBeFalse();
});

it('preserves approval and online status for an unchanged car submission', function () {
    $driver = onboardingDriver();
    onboardingDocuments($driver);
    $vehicle = onboardingVehicle($driver);
    $driver->update(['is_online' => true]);
    DriverAvailability::create(['driver_id' => $driver->id, 'status' => 'online', 'is_available' => true]);
    Sanctum::actingAs($driver);
    $payload = $vehicle->only(['car_category_id', 'registration_number', 'make', 'model', 'year', 'color', 'fuel_type', 'seats', 'is_ac']);
    $payload['registration_number'] = 'ka 01-ab 1234';

    $this->putJson('/api/driver-app/vehicle', $payload)->assertOk()
        ->assertJsonPath('vehicle.approval_status', 'approved');
    expect($driver->fresh()->is_online)->toBeTrue()
        ->and($driver->driverAvailability()->first()->status)->toBe('online');
});

it('checks vehicle uniqueness after formatting is normalized', function () {
    $vehicle = onboardingVehicle(onboardingDriver());
    Sanctum::actingAs(onboardingDriver());
    $payload = $vehicle->only(['car_category_id', 'registration_number', 'make', 'model', 'year', 'color', 'fuel_type', 'seats', 'is_ac']);
    $payload['registration_number'] = 'ka 01-ab 1234';

    $this->putJson('/api/driver-app/vehicle', $payload)->assertUnprocessable()->assertJsonValidationErrors('registration_number');
});

it('blocks rental listing when required driver documents need attention', function () {
    $driver = onboardingDriver();
    onboardingVehicle($driver);
    Sanctum::actingAs($driver);

    $this->putJson('/api/driver-app/vehicle/rental-availability', ['is_available_for_rent' => true])->assertUnprocessable();
    $this->putJson('/api/driver-app/vehicle/rental-availability', ['is_available_for_rent' => false])->assertOk();
});

it('resets only the replaced document and returns the next required action', function () {
    Storage::fake('public');
    Storage::fake('local');
    $driver = onboardingDriver();
    onboardingDocuments($driver);
    Storage::disk('public')->put('test/driving_license.pdf', 'old');
    $driver->documents()->where('type', 'driving_license')->update(['status' => 'rejected', 'rejection_reason' => 'Unreadable']);
    Sanctum::actingAs($driver);

    $this->post('/api/driver-app/documents', [
        'type' => 'driving_license', 'consent' => true, 'expires_at' => today()->toDateString(),
        'file' => UploadedFile::fake()->create('licence.pdf', 100, 'application/pdf'),
    ])->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.rejection_reason', null)
        ->assertJsonPath('verification.status', 'in_review')->assertJsonPath('verification.approved_count', 2);
    Storage::disk('public')->assertExists('test/driving_license.pdf');
    expect($driver->documents()->where('type', 'driving_license')->first()->versions()->count())->toBe(2);
});

it('refuses an administrator approval of an expired document', function () {
    $driver = onboardingDriver();
    onboardingDocuments($driver, 'pending');
    $document = $driver->documents()->first();
    $document->update(['expires_at' => today()->subDay()]);
    $admin = User::create(['name' => 'Reviewer', 'email' => 'reviewer@example.com', 'password' => 'password']);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Administrator']);
    $admin->roles()->syncWithoutDetaching([$role->id]);

    $this->actingAs($admin)->put("/admin/drivers/{$driver->id}/documents/{$document->id}", ['status' => 'approved'])
        ->assertSessionHasErrors('status');
    expect($document->fresh()->status)->toBe('pending');
});

<?php

use App\Models\CarCategory;
use App\Models\Driver;
use App\Models\Vehicle;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Storage::fake('public');
    $this->photoDriver = Driver::create([
        'name' => 'Photo Setup Driver', 'phone' => '89'.random_int(10000000, 99999999),
        'status' => 'pending', 'is_active' => true, 'is_approved' => false,
    ]);
    $category = CarCategory::create([
        'name' => 'Photo Sedan', 'slug' => 'photo-sedan', 'vehicle_type' => 'sedan',
        'seats' => 4, 'is_active' => true,
    ]);
    $this->carPayload = [
        'car_category_id' => $category->id, 'registration_number' => 'AS01AB1234',
        'make' => 'Toyota', 'model' => 'Etios', 'year' => 2024, 'color' => 'White',
        'fuel_type' => 'petrol', 'seats' => 4, 'is_ac' => '1',
    ];
    Sanctum::actingAs($this->photoDriver);
});

function vehiclePhotoUploads(): array
{
    return collect(['front', 'rear', 'left', 'right'])->mapWithKeys(fn ($side) => [
        $side => UploadedFile::fake()->image($side.'.jpg', 40, 30),
    ])->all();
}

it('provides dependent model choices and selectable vehicle attributes before setup', function () {
    $this->getJson('/api/driver-app/vehicle')->assertOk()->assertJsonPath('vehicle', null)
        ->assertJsonPath('setup_options.makes.Toyota.2', 'Etios')
        ->assertJsonPath('setup_options.years.0', now()->year + 1)
        ->assertJsonPath('setup_options.seats.0', 2)
        ->assertJsonPath('setup_options.colors.0', 'White');
});

it('allows an unapproved driver to submit four car photos with multipart details', function () {
    $this->post('/api/driver-app/vehicle', $this->carPayload + ['photos' => vehiclePhotoUploads()], ['Accept' => 'application/json'])
        ->assertOk()->assertJsonPath('vehicle.approval_status', 'pending')
        ->assertJsonCount(4, 'vehicle.photo_urls');
    $vehicle = $this->photoDriver->vehicle()->firstOrFail();
    expect($vehicle->photos)->toHaveCount(4);
    foreach ($vehicle->photos as $path) {
        Storage::disk('public')->assertExists($path);
    }
    $this->getJson('/api/driver-app/vehicle')->assertOk()->assertJsonCount(4, 'vehicle.photo_urls');
});

it('replaces one photo while preserving other views and restarts review', function () {
    $this->post('/api/driver-app/vehicle', $this->carPayload + ['photos' => vehiclePhotoUploads()], ['Accept' => 'application/json'])->assertOk();
    $vehicle = $this->photoDriver->vehicle()->firstOrFail();
    $previous = $vehicle->photos;
    $vehicle->update(['approval_status' => 'approved', 'is_active' => true]);
    $this->photoDriver->update(['is_online' => true]);
    $this->post('/api/driver-app/vehicle', $this->carPayload + ['photos' => ['front' => UploadedFile::fake()->image('new-front.jpg')]], ['Accept' => 'application/json'])
        ->assertOk()->assertJsonPath('vehicle.approval_status', 'pending');
    $vehicle->refresh();
    expect($vehicle->photos['front'])->not->toBe($previous['front']);
    expect($vehicle->photos['rear'])->toBe($previous['rear']);
    expect($this->photoDriver->fresh()->is_online)->toBeFalse();
    Storage::disk('public')->assertMissing($previous['front']);
    Storage::disk('public')->assertExists($previous['rear']);
});

it('rejects an incomplete set on the initial photo submission without storing files', function () {
    $this->post('/api/driver-app/vehicle', $this->carPayload + ['photos' => ['front' => UploadedFile::fake()->image('front.jpg')]], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['photos.rear', 'photos.left', 'photos.right']);
    expect(Vehicle::count())->toBe(0);
    expect(Storage::disk('public')->allFiles())->toBeEmpty();
});

it('rejects non-images and unknown photo views', function () {
    $photos = vehiclePhotoUploads();
    $photos['front'] = UploadedFile::fake()->create('front.pdf', 20, 'application/pdf');
    $photos['interior'] = UploadedFile::fake()->image('interior.jpg');
    $this->post('/api/driver-app/vehicle', $this->carPayload + ['photos' => $photos], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['photos', 'photos.front']);
    expect(Storage::disk('public')->allFiles())->toBeEmpty();
});

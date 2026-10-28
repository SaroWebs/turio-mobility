<?php

use App\Models\CarCategory;
use App\Models\Driver;
use App\Models\DriverLocation;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleLocation;

function gpsVehicle(): Vehicle
{
    $category = CarCategory::create([
        'name' => 'GPS Sedan',
        'slug' => 'gps-sedan-'.uniqid(),
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 1800,
        'is_active' => true,
    ]);
    $driver = Driver::create([
        'name' => 'Tracked Driver',
        'phone' => '87'.random_int(10000000, 99999999),
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);

    return Vehicle::create([
        'driver_id' => $driver->id,
        'car_category_id' => $category->id,
        'registration_number' => 'GPS'.random_int(100000, 999999),
        'make' => 'Tata',
        'model' => 'Tigor',
        'year' => 2025,
        'color' => 'Blue',
        'seats' => 4,
        'is_active' => true,
        'approval_status' => 'approved',
    ]);
}

function gpsAdmin(): User
{
    $admin = User::create([
        'name' => 'Fleet Admin',
        'email' => 'fleet-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    return $admin;
}

it('creates exactly one gps tracker identity for every vehicle', function () {
    $vehicle = gpsVehicle();

    expect($vehicle->tracker()->count())->toBe(1)
        ->and($vehicle->tracker->status)->toBe('unprovisioned')
        ->and($vehicle->tracker->device_uid)->toStartWith('SKY-');
});

it('lets an admin provision a tracker and reveals its token only once', function () {
    $vehicle = gpsVehicle();

    $response = $this->actingAs(gpsAdmin())
        ->post("/admin/vehicles/{$vehicle->id}/tracker/provision");

    $response->assertRedirect()
        ->assertSessionHas('tracker_credentials.vehicle_id', $vehicle->id)
        ->assertSessionHas('tracker_credentials.api_token');

    $tracker = $vehicle->tracker()->firstOrFail();
    expect($tracker->status)->toBe('active')
        ->and(array_key_exists('token_hash', $tracker->toArray()))->toBeFalse();
    $this->assertDatabaseHas('vehicle_trackers', [
        'vehicle_id' => $vehicle->id,
        'status' => 'active',
    ]);
});

it('accepts authenticated hardware pings and keeps an idempotent vehicle trail', function () {
    $vehicle = gpsVehicle();
    $response = $this->actingAs(gpsAdmin())
        ->post("/admin/vehicles/{$vehicle->id}/tracker/provision");
    $token = $response->getSession()->get('tracker_credentials')['api_token'];

    $payload = [
        'latitude' => 12.9716,
        'longitude' => 77.5946,
        'sequence_number' => 42,
        'speed_kmh' => 36.5,
        'heading' => 92,
        'battery_percent' => 84,
        'ignition_on' => true,
    ];

    $this->withToken($token)->postJson('/api/tracker/v1/location', $payload)
        ->assertAccepted()
        ->assertJsonPath('success', true);
    $this->withToken($token)->postJson('/api/tracker/v1/location', $payload)
        ->assertAccepted();
    $this->withToken($token)->postJson('/api/tracker/v1/location', [
        ...$payload,
        'sequence_number' => 41,
        'latitude' => 11.0000,
        'longitude' => 76.0000,
        'recorded_at' => now()->subHour()->toISOString(),
    ])->assertAccepted();

    expect(VehicleLocation::where('vehicle_id', $vehicle->id)->count())->toBe(2);
    $this->assertDatabaseHas('vehicle_trackers', [
        'vehicle_id' => $vehicle->id,
        'latitude' => 12.9716,
        'longitude' => 77.5946,
        'battery_percent' => 84,
        'ignition_on' => true,
    ]);
    $this->assertDatabaseHas('driver_availabilities', [
        'driver_id' => $vehicle->driver_id,
        'current_lat' => 12.9716,
        'current_lng' => 77.5946,
    ]);
});

it('rejects unknown tracker tokens and protects the admin tracking page', function () {
    $vehicle = gpsVehicle();

    $this->withToken('invalid')->postJson('/api/tracker/v1/location', [
        'latitude' => 12.9716,
        'longitude' => 77.5946,
    ])->assertUnauthorized();

    $this->get("/admin/vehicles/{$vehicle->id}/tracking")
        ->assertRedirect('/login');

    $this->actingAs(gpsAdmin())
        ->get("/admin/vehicles/{$vehicle->id}/tracking")
        ->assertOk();
});

it('falls back to the assigned driver location when vehicle gps is unavailable', function () {
    $vehicle = gpsVehicle();
    DriverLocation::create([
        'driver_id' => $vehicle->driver_id,
        'latitude' => 26.1445,
        'longitude' => 91.7362,
        'heading' => 42,
        'speed' => 18.5,
        'accuracy' => 9,
    ]);

    $this->actingAs(gpsAdmin())
        ->getJson("/admin/vehicles/{$vehicle->id}/tracking-data")
        ->assertOk()
        ->assertJsonPath('location_source', 'driver_app')
        ->assertJsonPath('is_online', true)
        ->assertJsonPath('latest_location.latitude', '26.14450000')
        ->assertJsonPath('latest_location.longitude', '91.73620000')
        ->assertJsonCount(1, 'locations');
});

<?php

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\RideBooking;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

it('completes the customer-to-driver cash ride cycle through public app APIs', function () {
    Event::fake();

    $customer = Customer::create([
        'name' => 'Cycle Customer',
        'phone' => '9000000199',
        'is_active' => true,
    ]);
    $driver = Driver::create([
        'name' => 'Cycle Driver',
        'phone' => '8000000199',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
    ]);
    $category = CarCategory::create([
        'name' => 'Cycle Sedan',
        'slug' => 'cycle-sedan',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 1800,
        'is_active' => true,
    ]);
    Vehicle::create([
        'driver_id' => $driver->id,
        'car_category_id' => $category->id,
        'registration_number' => 'RJ14CY0199',
        'make' => 'Maruti',
        'model' => 'Ciaz',
        'year' => 2025,
        'color' => 'White',
        'seats' => 4,
        'is_active' => true,
        'approval_status' => 'approved',
    ]);
    DriverAvailability::create([
        'last_updated' => now(),
        'driver_id' => $driver->id,
        'is_available' => true,
        'status' => 'online',
        'current_lat' => 26.8242,
        'current_lng' => 75.8122,
    ]);

    Sanctum::actingAs($customer);
    $created = $this->postJson('/api/customer-app/rides', [
        'service_type' => 'point_to_point',
        'pickup_location' => 'Jaipur Airport',
        'pickup_lat' => 26.8242,
        'pickup_lng' => 75.8122,
        'dropoff_location' => 'Amber Fort',
        'dropoff_lat' => 26.9855,
        'dropoff_lng' => 75.8513,
        'scheduled_at' => now()->addMinutes(10)->toISOString(),
        'payment_method' => 'cash',
    ])->assertCreated()
        ->assertJsonPath('dispatch.candidate_driver_ids.0', $driver->id);

    $rideId = (int) $created->json('data.id');

    Sanctum::actingAs($driver);
    $this->getJson('/api/driver-app/pending-rides')
        ->assertOk()
        ->assertJsonPath('rides.0.id', $rideId);
    $this->postJson("/api/driver-app/rides/{$rideId}/accept")
        ->assertOk()
        ->assertJsonPath('ride.status', 'driver_assigned');
    $this->postJson("/api/driver-app/tracking/ride/{$rideId}/status", ['status' => 'on_the_way'])
        ->assertOk()
        ->assertJsonPath('data.status', 'driver_arriving');
    $this->postJson("/api/driver-app/tracking/ride/{$rideId}/status", ['status' => 'arrived'])
        ->assertOk()
        ->assertJsonPath('data.status', 'pickup');

    $startPin = RideBooking::findOrFail($rideId)->start_ride_pin;
    $this->postJson("/api/driver-app/tracking/ride/{$rideId}/status", [
        'status' => 'started',
        'start_pin' => $startPin,
    ])->assertOk()
        ->assertJsonPath('data.status', 'in_transit');
    $this->postJson("/api/driver-app/tracking/ride/{$rideId}/status", ['status' => 'completed', 'cash_received' => true])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.payment_status', 'paid');

    Sanctum::actingAs($customer);
    $this->getJson("/api/customer-app/tracking/ride/{$rideId}")
        ->assertOk()
        ->assertJsonPath('data.booking.status', 'completed')
        ->assertJsonPath('data.status_steps.4.done', true);

    $this->assertDatabaseHas('driver_availabilities', [
        'driver_id' => $driver->id,
        'is_available' => true,
    ]);
});

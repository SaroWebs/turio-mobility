<?php

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\RideBooking;
use App\Models\Tour;
use App\Models\TourDriverAssignment;
use App\Models\TourSchedule;
use App\Models\Vehicle;
use Laravel\Sanctum\Sanctum;

it('blocks a driver from accepting work in another module while engaged', function () {
    $driver = Driver::create([
        'name' => 'Exclusive Driver', 'phone' => '8000000077', 'status' => 'active', 'is_active' => true,
        'is_approved' => true, 'can_tour_transport' => true, 'can_short_ride' => true,
    ]);
    $category = CarCategory::create(['name' => 'Engagement Car', 'slug' => 'engagement-car', 'vehicle_type' => 'sedan', 'seats' => 4, 'base_price_per_day' => 1500]);
    $vehicle = Vehicle::create([
        'car_category_id' => $category->id, 'driver_id' => $driver->id, 'registration_number' => 'LOCK-0077',
        'make' => 'Honda', 'model' => 'City', 'year' => 2025, 'color' => 'White', 'seats' => 4,
        'is_active' => true, 'approval_status' => 'approved',
        'insurance_expiry' => now()->addYear(), 'permit_expiry' => now()->addYear(),
        'fitness_expiry' => now()->addYear(), 'pollution_expiry' => now()->addYear(),
    ]);
    DriverAvailability::create(['driver_id' => $driver->id, 'is_available' => true, 'status' => 'online']);
    $tour = Tour::create(['title' => 'Exclusive Tour', 'slug' => 'exclusive-tour', 'price_per_person' => 1000, 'child_price' => 500, 'is_active' => true]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id, 'departure_date' => now(), 'return_date' => now()->addDay(), 'total_seats' => 4, 'status' => 'open',
    ]);
    $assignment = TourDriverAssignment::create([
        'tour_schedule_id' => $schedule->id, 'driver_id' => $driver->id, 'vehicle_id' => $vehicle->id,
        'role' => 'transport', 'status' => 'assigned',
    ]);
    Sanctum::actingAs($driver);

    $this->postJson('/api/driver-app/tour-assignments/'.$assignment->id.'/accept')->assertOk();
    $this->assertDatabaseHas('driver_availabilities', ['driver_id' => $driver->id, 'is_available' => false, 'status' => 'on_tour']);

    $customer = Customer::create(['name' => 'Ride Guest', 'phone' => '9000000078']);
    $ride = RideBooking::create([
        'customer_id' => $customer->id, 'customer_name' => $customer->name, 'customer_phone' => $customer->phone,
        'service_type' => 'point_to_point', 'pickup_location' => 'A', 'dropoff_location' => 'B',
        'scheduled_at' => now(), 'estimated_distance_km' => 8, 'total_fare' => 300, 'status' => 'pending',
    ]);

    $this->postJson('/api/driver-app/rides/'.$ride->id.'/accept')
        ->assertStatus(422)
        ->assertJsonPath('errors.eligibility.0', 'Driver already has an active ride, tour, or rental assignment.');

    $this->postJson('/api/driver-app/tour-assignments/'.$assignment->id.'/complete')->assertOk();
    $this->assertDatabaseHas('driver_availabilities', ['driver_id' => $driver->id, 'is_available' => true, 'status' => 'online']);
});

<?php

use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\RideBooking;
use App\Models\Role;
use App\Models\Tour;
use App\Models\TourDriverAssignment;
use App\Models\TourSchedule;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\ResourceCommitmentService;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->admin = User::create([
        'name' => 'Commitment Admin',
        'email' => 'admin-commitment@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $this->admin->roles()->attach($role);

    $this->driver = Driver::create([
        'name' => 'Commitment Driver',
        'phone' => '9888800001',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_tour_transport' => true,
        'can_tour_lead' => true,
        'can_rental' => true,
        'can_short_ride' => true,
        'can_long_ride' => true,
    ]);

    $this->category = CarCategory::create([
        'name' => 'Commitment Sedan',
        'slug' => 'commitment-sedan',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 2000,
    ]);

    $this->vehicle = Vehicle::create([
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver->id,
        'registration_number' => 'COMM-0001',
        'make' => 'Toyota',
        'model' => 'Etios',
        'year' => 2024,
        'color' => 'Silver',
        'seats' => 4,
        'is_active' => true,
        'approval_status' => 'approved',
        'insurance_expiry' => now()->addYear(),
        'permit_expiry' => now()->addYear(),
        'fitness_expiry' => now()->addYear(),
        'pollution_expiry' => now()->addYear(),
    ]);

    DriverAvailability::create([
        'driver_id' => $this->driver->id,
        'is_available' => true,
        'status' => 'online',
        'last_updated' => now(),
        'current_lat' => 12.9716,
        'current_lng' => 77.5946,
    ]);

    $this->customer = Customer::create([
        'name' => 'Commitment Customer',
        'phone' => '9888800002',
    ]);

    $this->tour = Tour::create([
        'title' => 'Commitment Tour',
        'slug' => 'commitment-tour',
        'price_per_person' => 1500,
        'is_active' => true,
    ]);
});

it('acquires resource locks deterministically regardless of input order', function () {
    $service = app(ResourceCommitmentService::class);

    // Call with driver first, then vehicle
    $locks1 = $service->lockResources($this->driver->id, $this->vehicle->id);
    expect($locks1['driver']?->id)->toBe($this->driver->id)
        ->and($locks1['vehicle']?->id)->toBe($this->vehicle->id);

    // Call with vehicle and driver
    $locks2 = $service->lockResources($this->driver->id, null);
    expect($locks2['driver']?->id)->toBe($this->driver->id)
        ->and($locks2['vehicle'])->toBeNull();

    $locks3 = $service->lockResources(null, $this->vehicle->id);
    expect($locks3['driver'])->toBeNull()
        ->and($locks3['vehicle']?->id)->toBe($this->vehicle->id);
});

it('counts active tour workload from departure until the business-local return boundary', function () {
    config(['app.business_timezone' => 'Asia/Kolkata']);
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 04:00:00', 'UTC'));
    $schedule = TourSchedule::create([
        'tour_id' => $this->tour->id, 'departure_date' => '2026-09-25', 'departure_time' => '14:00:00',
        'return_date' => '2026-09-25', 'total_seats' => 10, 'status' => 'open',
    ]);
    $assignment = \App\Models\TourDriverAssignment::create([
        'tour_schedule_id' => $schedule->id, 'driver_id' => $this->driver->id,
        'vehicle_id' => $this->vehicle->id, 'role' => 'transport', 'status' => 'accepted',
    ]);
    $service = app(\App\Services\DriverDispatchService::class);
    expect($service->hasActiveWorkload($this->driver))->toBeFalse();
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 08:30:00', 'UTC'));
    expect($service->hasActiveWorkload($this->driver))->toBeTrue();
    expect($service->hasActiveWorkload($this->driver, $assignment->id))->toBeFalse();
    $schedule->update(['status' => 'cancelled']);
    expect($service->hasActiveWorkload($this->driver))->toBeFalse();
    $schedule->update(['status' => 'completed']);
    expect($service->hasActiveWorkload($this->driver))->toBeFalse();
    $schedule->update(['status' => 'open']);
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 18:29:59', 'UTC'));
    expect($service->hasActiveWorkload($this->driver))->toBeTrue();
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 18:30:00', 'UTC'));
    expect($service->hasActiveWorkload($this->driver))->toBeFalse();
});

it('scores only future nonterminal tour assignments at the departure boundary', function () {
    config(['app.business_timezone' => 'Asia/Kolkata']);
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 04:00:00', 'UTC'));
    $schedule = TourSchedule::create(['tour_id' => $this->tour->id,
        'departure_date' => '2026-09-25', 'departure_time' => '14:00:00', 'return_date' => '2026-09-25',
        'total_seats' => 10, 'status' => 'open']);
    TourDriverAssignment::create(['tour_schedule_id' => $schedule->id, 'driver_id' => $this->driver->id,
        'vehicle_id' => $this->vehicle->id, 'role' => 'transport', 'status' => 'accepted']);
    $service = app(\App\Services\DriverDispatchService::class);
    expect($service->workloadScore($this->driver))->toBe(1);
    $schedule->update(['status' => 'cancelled']);
    expect($service->workloadScore($this->driver))->toBe(0);
    $schedule->update(['status' => 'completed']);
    expect($service->workloadScore($this->driver))->toBe(0);
    $schedule->update(['status' => 'open']);
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 08:30:00', 'UTC'));
    expect($service->workloadScore($this->driver))->toBe(0);
    expect($service->hasActiveWorkload($this->driver))->toBeTrue();
});

it('rejects tour schedule assignment when driver has overlapping tour schedule', function () {
    $start = now()->addDays(5)->toDateString();
    $end = now()->addDays(7)->toDateString();

    $schedule1 = TourSchedule::create([
        'tour_id' => $this->tour->id,
        'departure_date' => $start,
        'return_date' => $end,
        'departure_time' => '09:00',
        'departure_point' => 'Hub A',
        'total_seats' => 10,
        'status' => 'open',
    ]);

    $schedule2 = TourSchedule::create([
        'tour_id' => $this->tour->id,
        'departure_date' => now()->addDays(6)->toDateString(),
        'return_date' => now()->addDays(8)->toDateString(),
        'departure_time' => '10:00',
        'departure_point' => 'Hub B',
        'total_seats' => 10,
        'status' => 'open',
    ]);

    // Assign driver to schedule1 successfully
    $this->actingAs($this->admin)
        ->postJson("/admin/tours/{$this->tour->id}/schedules/{$schedule1->id}/assign-driver", [
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
            'role' => 'transport',
        ])
        ->assertOk();

    $this->assertDatabaseHas('tour_driver_assignments', [
        'tour_schedule_id' => $schedule1->id,
        'driver_id' => $this->driver->id,
        'status' => 'assigned',
    ]);

    // Attempting to assign same driver to overlapping schedule2 must fail
    $this->actingAs($this->admin)
        ->postJson("/admin/tours/{$this->tour->id}/schedules/{$schedule2->id}/assign-driver", [
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
            'role' => 'transport',
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.driver_id.0', fn ($msg) => str_contains($msg, 'already committed to tour'));

    // Reassigning same driver on schedule1 (e.g. updating role) does NOT self-conflict
    $this->actingAs($this->admin)
        ->postJson("/admin/tours/{$this->tour->id}/schedules/{$schedule1->id}/assign-driver", [
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
            'role' => 'lead',
        ])
        ->assertOk();

    $this->assertDatabaseHas('tour_driver_assignments', [
        'tour_schedule_id' => $schedule1->id,
        'driver_id' => $this->driver->id,
        'role' => 'lead',
    ]);
});

it('rejects tour schedule assignment when driver or vehicle has overlapping car rental', function () {
    $rStart = now()->addDays(10)->toDateString();
    $rEnd = now()->addDays(12)->toDateString();

    CarRental::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver->id,
        'vehicle_id' => $this->vehicle->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'start_date' => $rStart,
        'end_date' => $rEnd,
        'number_of_days' => 3,
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'pickup_location' => 'Airport',
        'base_price' => 4000,
        'total_price' => 4000,
    ]);

    // Overlapping tour departure
    $schedule = TourSchedule::create([
        'tour_id' => $this->tour->id,
        'departure_date' => now()->addDays(11)->toDateString(),
        'return_date' => now()->addDays(13)->toDateString(),
        'departure_time' => '08:00',
        'departure_point' => 'City Center',
        'total_seats' => 10,
        'status' => 'open',
    ]);

    $this->actingAs($this->admin)
        ->postJson("/admin/tours/{$this->tour->id}/schedules/{$schedule->id}/assign-driver", [
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.driver_id.0', fn ($msg) => str_contains($msg, 'already committed to rental booking'));

    // Non-overlapping tour departure succeeds
    $nonOverlappingSchedule = TourSchedule::create([
        'tour_id' => $this->tour->id,
        'departure_date' => now()->addDays(14)->toDateString(),
        'return_date' => now()->addDays(15)->toDateString(),
        'departure_time' => '08:00',
        'departure_point' => 'City Center',
        'total_seats' => 10,
        'status' => 'open',
    ]);

    $this->actingAs($this->admin)
        ->postJson("/admin/tours/{$this->tour->id}/schedules/{$nonOverlappingSchedule->id}/assign-driver", [
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])
        ->assertOk();
});

it('rejects car rental assignment when driver or vehicle has overlapping tour schedule', function () {
    $tStart = now()->addDays(20)->toDateString();
    $tEnd = now()->addDays(22)->toDateString();

    $schedule = TourSchedule::create([
        'tour_id' => $this->tour->id,
        'departure_date' => $tStart,
        'return_date' => $tEnd,
        'departure_time' => '07:00',
        'departure_point' => 'Terminal',
        'total_seats' => 10,
        'status' => 'open',
    ]);

    TourDriverAssignment::create([
        'tour_schedule_id' => $schedule->id,
        'driver_id' => $this->driver->id,
        'vehicle_id' => $this->vehicle->id,
        'role' => 'transport',
        'status' => 'assigned',
    ]);

    $rental = CarRental::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'start_date' => now()->addDays(21)->toDateString(),
        'end_date' => now()->addDays(23)->toDateString(), 'number_of_days' => 3,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'pickup_location' => 'Hotel',
        'base_price' => 4000,
        'total_price' => 4000,
    ]);

    $this->actingAs($this->admin)
        ->postJson("/admin/car-rentals/{$rental->id}/assign-driver", [
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.driver_id.0', fn ($msg) => str_contains($msg, 'already committed to tour'));
});

it('rejects ride booking assignment when driver has overlapping tour assignment', function () {
    $schedule = TourSchedule::create([
        'tour_id' => $this->tour->id,
        'departure_date' => now()->addDays(3)->toDateString(),
        'return_date' => now()->addDays(4)->toDateString(),
        'departure_time' => '09:00',
        'departure_point' => 'Station',
        'total_seats' => 10,
        'status' => 'open',
    ]);

    TourDriverAssignment::create([
        'tour_schedule_id' => $schedule->id,
        'driver_id' => $this->driver->id,
        'vehicle_id' => $this->vehicle->id,
        'role' => 'transport',
        'status' => 'accepted',
    ]);

    $ride = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Point A',
        'dropoff_location' => 'Point B',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => now()->addDays(3)->setTime(14, 0),
        'estimated_distance_km' => 12,
        'total_fare' => 500,
        'status' => 'confirmed',
    ]);

    $this->actingAs($this->admin)
        ->postJson("/admin/ride-bookings/{$ride->id}/assign-driver", [
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.driver_id.0', fn ($msg) => str_contains($msg, 'already committed to tour'));
});

it('rejects driver app tour acceptance if driver has conflicting rental commitment', function () {
    $tStart = now()->addDays(15)->toDateString();
    $tEnd = now()->addDays(16)->toDateString();

    $schedule = TourSchedule::create([
        'tour_id' => $this->tour->id,
        'departure_date' => $tStart,
        'return_date' => $tEnd,
        'departure_time' => '06:00',
        'departure_point' => 'Base',
        'total_seats' => 10,
        'status' => 'open',
    ]);

    $assignment = TourDriverAssignment::create([
        'tour_schedule_id' => $schedule->id,
        'driver_id' => $this->driver->id,
        'vehicle_id' => $this->vehicle->id,
        'role' => 'transport',
        'status' => 'assigned',
    ]);

    // Create a conflicting car rental
    CarRental::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver->id,
        'vehicle_id' => $this->vehicle->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'start_date' => $tStart,
        'end_date' => $tEnd,
        'number_of_days' => 2,
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'pickup_location' => 'Station',
        'base_price' => 3000,
        'total_price' => 3000,
    ]);

    Sanctum::actingAs($this->driver);

    // Driver attempts to accept tour assignment with overlapping rental commitment
    $this->postJson("/api/driver-app/tour-assignments/{$assignment->id}/accept")
        ->assertStatus(409);

    $this->assertDatabaseHas('tour_driver_assignments', [
        'id' => $assignment->id,
        'status' => 'assigned',
    ]);
});

it('does not block assignments when conflicting workload was cancelled', function () {
    $date = now()->addDays(30)->toDateString();

    $cancelledRental = CarRental::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver->id,
        'vehicle_id' => $this->vehicle->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'start_date' => $date,
        'end_date' => $date,
        'number_of_days' => 1,
        'status' => 'cancelled',
        'payment_status' => 'refunded',
        'pickup_location' => 'Office',
        'base_price' => 2000,
        'total_price' => 2000,
    ]);

    $schedule = TourSchedule::create([
        'tour_id' => $this->tour->id,
        'departure_date' => $date,
        'return_date' => $date,
        'departure_time' => '09:00',
        'departure_point' => 'Gate 1',
        'total_seats' => 10,
        'status' => 'open',
    ]);

    $this->actingAs($this->admin)
        ->postJson("/admin/tours/{$this->tour->id}/schedules/{$schedule->id}/assign-driver", [
            'driver_id' => $this->driver->id,
            'vehicle_id' => $this->vehicle->id,
        ])
        ->assertOk();

    $this->assertDatabaseHas('tour_driver_assignments', [
        'tour_schedule_id' => $schedule->id,
        'driver_id' => $this->driver->id,
        'status' => 'assigned',
    ]);
});

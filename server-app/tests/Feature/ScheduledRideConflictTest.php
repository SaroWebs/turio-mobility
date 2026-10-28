<?php

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\RideBooking;
use App\Models\RideDispatchAttempt;
use App\Models\Role;
use App\Models\Tour;
use App\Models\TourDriverAssignment;
use App\Models\TourSchedule;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\DriverDispatchService;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->admin = User::create([
        'name' => 'Dispatch Admin',
        'email' => 'admin-dispatch@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $this->admin->roles()->attach($role);

    $this->driver1 = Driver::create([
        'name' => 'Driver One',
        'phone' => '9888810001',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
        'can_long_ride' => true,
    ]);

    $this->driver2 = Driver::create([
        'name' => 'Driver Two',
        'phone' => '9888810002',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
        'can_long_ride' => true,
    ]);

    $this->category = CarCategory::create([
        'name' => 'Conflict Sedan',
        'slug' => 'conflict-sedan',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 2000,
    ]);

    $this->vehicle1 = Vehicle::create([
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver1->id,
        'registration_number' => 'CONF-0001',
        'make' => 'Toyota',
        'model' => 'Etios',
        'year' => 2024,
        'color' => 'White',
        'seats' => 4,
        'is_active' => true,
        'approval_status' => 'approved',
        'insurance_expiry' => now()->addYear(),
        'permit_expiry' => now()->addYear(),
        'fitness_expiry' => now()->addYear(),
        'pollution_expiry' => now()->addYear(),
    ]);

    $this->vehicle2 = Vehicle::create([
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver2->id,
        'registration_number' => 'CONF-0002',
        'make' => 'Hyundai',
        'model' => 'Aura',
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

    $this->avail1 = DriverAvailability::create([
        'driver_id' => $this->driver1->id,
        'is_available' => true,
        'status' => 'online',
        'last_updated' => now(),
        'current_lat' => 12.9716,
        'current_lng' => 77.5946,
    ]);

    $this->avail2 = DriverAvailability::create([
        'driver_id' => $this->driver2->id,
        'is_available' => true,
        'status' => 'online',
        'last_updated' => now(),
        'current_lat' => 12.9720,
        'current_lng' => 77.5950,
    ]);

    $this->customer = Customer::create([
        'name' => 'Conflict Customer',
        'phone' => '9888810003',
    ]);
});

it('allows assigning a driver to multiple non-overlapping scheduled rides on the same day', function () {
    $targetDay = now()->addDays(5)->startOfDay();

    // Morning ride: 09:00 AM (duration 30 mins)
    $morningRide = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Point A',
        'dropoff_location' => 'Point B',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $targetDay->copy()->setTime(9, 0),
        'estimated_duration' => 30,
        'estimated_distance_km' => 10,
        'total_fare' => 300,
        'status' => 'confirmed',
    ]);

    // Afternoon ride: 02:00 PM (duration 45 mins) - 5 hours after morning ride finishes
    $afternoonRide = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Point C',
        'dropoff_location' => 'Point D',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $targetDay->copy()->setTime(14, 0),
        'estimated_duration' => 45,
        'estimated_distance_km' => 15,
        'total_fare' => 450,
        'status' => 'confirmed',
    ]);

    // Assign driver to morning ride
    $this->actingAs($this->admin)
        ->postJson("/admin/ride-bookings/{$morningRide->id}/assign-driver", [
            'driver_id' => $this->driver1->id,
            'vehicle_id' => $this->vehicle1->id,
        ])
        ->assertOk();

    // Assign same driver to afternoon ride - must SUCCEED because there is no interval overlap
    $this->actingAs($this->admin)
        ->postJson("/admin/ride-bookings/{$afternoonRide->id}/assign-driver", [
            'driver_id' => $this->driver1->id,
            'vehicle_id' => $this->vehicle1->id,
        ])
        ->assertOk();

    expect($morningRide->fresh()->driver_id)->toBe($this->driver1->id)
        ->and($afternoonRide->fresh()->driver_id)->toBe($this->driver1->id);
});

it('rejects assigning driver when two scheduled rides overlap in time on the same day', function () {
    $targetDay = now()->addDays(6)->startOfDay();

    // Ride 1: 10:00 AM (duration 45 mins + 15 min buffer = interval until 11:00 AM)
    $ride1 = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Point A',
        'dropoff_location' => 'Point B',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $targetDay->copy()->setTime(10, 0),
        'estimated_duration' => 45,
        'estimated_distance_km' => 15,
        'total_fare' => 450,
        'status' => 'confirmed',
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
    ]);

    // Ride 2: 10:30 AM (starts before Ride 1 buffer ends)
    $ride2 = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Point C',
        'dropoff_location' => 'Point D',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $targetDay->copy()->setTime(10, 30),
        'estimated_duration' => 30,
        'estimated_distance_km' => 10,
        'total_fare' => 300,
        'status' => 'confirmed',
    ]);

    // Assigning driver1 to ride2 must fail due to overlap
    $this->actingAs($this->admin)
        ->postJson("/admin/ride-bookings/{$ride2->id}/assign-driver", [
            'driver_id' => $this->driver1->id,
            'vehicle_id' => $this->vehicle1->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.driver_id.0', fn ($msg) => str_contains($msg, 'conflicting ride booking'));

    expect($ride2->fresh()->driver_id)->toBeNull();
});

it('rejects scheduled ride assignment crossing midnight with an overlapping ride', function () {
    $day1 = now()->addDays(7)->setTime(23, 45); // Day 1 23:45
    // duration 60m + 15m buffer = until 01:00 on Day 2

    $lateNightRide = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Airport',
        'dropoff_location' => 'City',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $day1,
        'estimated_duration' => 60,
        'estimated_distance_km' => 35,
        'total_fare' => 900,
        'status' => 'confirmed',
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
    ]);

    // Early morning ride on Day 2 at 00:30 AM (overlaps with lateNightRide)
    $earlyMorningRide = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'City',
        'dropoff_location' => 'Suburb',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $day1->copy()->addMinutes(45), // 00:30 on Day 2
        'estimated_duration' => 30,
        'estimated_distance_km' => 10,
        'total_fare' => 300,
        'status' => 'confirmed',
    ]);

    $this->actingAs($this->admin)
        ->postJson("/admin/ride-bookings/{$earlyMorningRide->id}/assign-driver", [
            'driver_id' => $this->driver1->id,
            'vehicle_id' => $this->vehicle1->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.driver_id.0', fn ($msg) => str_contains($msg, 'conflicting ride booking'));
});

it('excludes drivers with conflicting scheduled commitments during candidate ranking', function () {
    $dispatchService = app(DriverDispatchService::class);
    $rideTime = now()->addDays(8)->setTime(15, 0);

    // Give driver1 an existing committed ride at 15:00
    RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Hub',
        'dropoff_location' => 'Mall',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $rideTime,
        'estimated_duration' => 45,
        'estimated_distance_km' => 15,
        'total_fare' => 450,
        'status' => 'confirmed',
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
    ]);

    // Create a new ride scheduled at 15:15 (overlaps with driver1's ride)
    $newRide = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Point X',
        'dropoff_location' => 'Point Y',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $rideTime->copy()->addMinutes(15),
        'estimated_duration' => 30,
        'estimated_distance_km' => 10,
        'total_fare' => 350,
        'status' => 'pending',
    ]);

    $candidates = $dispatchService->rankedCandidates(
        'short_ride',
        12.9716,
        77.5946,
        null,
        10,
        $this->category->id,
        false,
        30.0,
        null,
        $newRide
    );

    // Driver 1 must be filtered out; Driver 2 must be included
    $driverIds = $candidates->pluck('driver_id')->all();
    expect($driverIds)->toContain($this->driver2->id)
        ->and($driverIds)->not->toContain($this->driver1->id);
});

it('persists wave numbers and expands radius across sequential dispatch waves', function () {
    $dispatchService = app(DriverDispatchService::class);

    $dueRide = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Wave Hub',
        'dropoff_location' => 'Dropoff',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => now()->addMinutes(5), // within dispatch window
        'estimated_duration' => 30,
        'estimated_distance_km' => 10,
        'total_fare' => 300,
        'status' => 'pending',
    ]);

    // Wave 1 dispatch
    $dispatched = $dispatchService->dispatchDueRides();
    expect($dispatched)->toBe(1);

    $attemptsWave1 = RideDispatchAttempt::where('ride_booking_id', $dueRide->id)->get();
    expect($attemptsWave1)->not->toBeEmpty();
    foreach ($attemptsWave1 as $att) {
        expect($att->wave_number)->toBe(1);
    }

    // Simulate all wave 1 attempts expiring
    RideDispatchAttempt::where('ride_booking_id', $dueRide->id)->update([
        'status' => 'expired',
        'expires_at' => now()->subMinute(),
    ]);

    // Introduce a third driver further away (outside 30km, but within 45km expansion)
    $driverFar = Driver::create([
        'name' => 'Driver Far',
        'phone' => '9888810099',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
        'can_long_ride' => true,
    ]);
    Vehicle::create([
        'car_category_id' => $this->category->id,
        'driver_id' => $driverFar->id,
        'registration_number' => 'CONF-0099',
        'make' => 'Toyota',
        'model' => 'Etios',
        'year' => 2024,
        'color' => 'White',
        'seats' => 4,
        'is_active' => true,
        'approval_status' => 'approved',
        'insurance_expiry' => now()->addYear(),
        'permit_expiry' => now()->addYear(),
        'fitness_expiry' => now()->addYear(),
        'pollution_expiry' => now()->addYear(),
    ]);
    // Approx 35 km away
    DriverAvailability::create([
        'driver_id' => $driverFar->id,
        'is_available' => true,
        'status' => 'online',
        'last_updated' => now(),
        'current_lat' => 13.2500,
        'current_lng' => 77.5946,
    ]);

    // Wave 2 dispatch
    $dispatchedWave2 = $dispatchService->dispatchDueRides();
    expect($dispatchedWave2)->toBe(1);

    $attemptWave2 = RideDispatchAttempt::where('ride_booking_id', $dueRide->id)
        ->where('driver_id', $driverFar->id)
        ->first();

    expect($attemptWave2)->not->toBeNull()
        ->and($attemptWave2->wave_number)->toBe(2);
});

it('restores previous driver availability when admin reassigns a ride and previous driver is idle', function () {
    $ride = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Reassign A',
        'dropoff_location' => 'Reassign B',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => now()->addMinutes(10),
        'estimated_duration' => 30,
        'estimated_distance_km' => 10,
        'total_fare' => 300,
        'status' => 'driver_assigned',
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
    ]);

    $this->avail1->update(['is_available' => false, 'status' => 'on_ride']);

    // Admin reassigns ride to Driver 2
    $this->actingAs($this->admin)
        ->postJson("/admin/ride-bookings/{$ride->id}/assign-driver", [
            'driver_id' => $this->driver2->id,
            'vehicle_id' => $this->vehicle2->id,
        ])
        ->assertOk();

    // Driver 1 must have availability restored to online and available
    expect($this->avail1->fresh()->is_available)->toBeTrue()
        ->and($this->avail1->fresh()->status)->toBe('online')
        ->and($ride->fresh()->driver_id)->toBe($this->driver2->id);
});

it('rejects scheduled ride assignment when driver is committed to a tour during that window', function () {
    $tourDate = now()->addDays(10)->toDateString();

    $tour = Tour::create([
        'title' => 'Day Trip Tour',
        'slug' => 'day-trip-tour',
        'price_per_person' => 1500,
        'is_active' => true,
    ]);

    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => $tourDate,
        'return_date' => $tourDate,
        'departure_time' => '08:00',
        'departure_point' => 'Station',
        'total_seats' => 10,
        'status' => 'open',
    ]);

    TourDriverAssignment::create([
        'tour_schedule_id' => $schedule->id,
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
        'role' => 'transport',
        'status' => 'accepted',
    ]);

    // Same day ride at 11:00 AM overlaps with tour
    $conflictingRide = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Hotel',
        'dropoff_location' => 'Mall',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => now()->addDays(10)->setTime(11, 0),
        'estimated_duration' => 30,
        'estimated_distance_km' => 10,
        'total_fare' => 300,
        'status' => 'confirmed',
    ]);

    $this->actingAs($this->admin)
        ->postJson("/admin/ride-bookings/{$conflictingRide->id}/assign-driver", [
            'driver_id' => $this->driver1->id,
            'vehicle_id' => $this->vehicle1->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.driver_id.0', fn ($msg) => str_contains($msg, 'already committed to tour'));

    // Next day ride at 09:00 AM does NOT overlap with the tour
    $nextDayRide = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Hotel',
        'dropoff_location' => 'Mall',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => now()->addDays(11)->setTime(9, 0),
        'estimated_duration' => 30,
        'estimated_distance_km' => 10,
        'total_fare' => 300,
        'status' => 'confirmed',
    ]);

    $this->actingAs($this->admin)
        ->postJson("/admin/ride-bookings/{$nextDayRide->id}/assign-driver", [
            'driver_id' => $this->driver1->id,
            'vehicle_id' => $this->vehicle1->id,
        ])
        ->assertOk();

    expect($nextDayRide->fresh()->driver_id)->toBe($this->driver1->id);
});

it('rejects driver API acceptance when driver has an overlapping scheduled commitment', function () {
    $targetTime = now()->addMinutes(5); // within 15 min dispatch window

    // Driver 1 already has a scheduled ride at the same time
    RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Existing A',
        'dropoff_location' => 'Existing B',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $targetTime,
        'estimated_duration' => 45,
        'estimated_distance_km' => 12,
        'total_fare' => 400,
        'status' => 'driver_assigned',
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
    ]);

    // Another ride within the same time window
    $anotherRide = RideBooking::create([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point',
        'pickup_location' => 'Conflicting A',
        'dropoff_location' => 'Conflicting B',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => $targetTime->copy()->addMinutes(10),
        'estimated_duration' => 30,
        'estimated_distance_km' => 10,
        'total_fare' => 300,
        'status' => 'pending',
    ]);

    Sanctum::actingAs($this->driver1);

    // Driver attempts to accept conflicting ride via driver API
    $response = $this->postJson("/api/driver-app/rides/{$anotherRide->id}/accept");
    // Driver already has active/conflicting workload, so acceptance is rejected
    expect($response->status())->toBeIn([409, 422, 200]);
    if ($response->status() === 200) {
        expect($response->json('success'))->toBeFalse();
    }
    expect($anotherRide->fresh()->driver_id)->toBeNull();
});

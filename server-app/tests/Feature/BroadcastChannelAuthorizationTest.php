<?php

use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourDriverAssignment;
use App\Models\TourSchedule;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

function broadcastChannelCallback(string $pattern): callable
{
    return Broadcast::getChannels()->get($pattern)
        ?? throw new RuntimeException("Broadcast channel [{$pattern}] is not registered.");
}

it('authorizes ride tracking channels for the booking customer, assigned driver, and admin only', function () {
    $admin = User::create(['name' => 'Broadcast Admin', 'email' => 'broadcast-admin@example.com', 'password' => 'password']);
    $customer = Customer::create(['name' => 'Ride Channel Customer', 'phone' => '9300000001']);
    $otherCustomer = Customer::create(['name' => 'Other Ride Customer', 'phone' => '9300000002']);
    $driver = Driver::create(['name' => 'Ride Channel Driver', 'phone' => '8300000001']);
    $otherDriver = Driver::create(['name' => 'Other Ride Driver', 'phone' => '8300000002']);

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Lobby',
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 8,
        'total_fare' => 300,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    $authorize = broadcastChannelCallback('ride.{bookingId}');

    expect($authorize($customer, $ride->id))->toBeTrue()
        ->and($authorize($driver, $ride->id))->toBeTrue()
        ->and($authorize($admin, $ride->id))->toBeTrue()
        ->and($authorize($otherCustomer, $ride->id))->toBeFalse()
        ->and($authorize($otherDriver, $ride->id))->toBeFalse()
        ->and($authorize($customer, 999999))->toBeFalse();
});

it('authorizes tour and rental tracking channels for owners, assigned drivers, and admin only', function () {
    $admin = User::create(['name' => 'Tracking Admin', 'email' => 'tracking-admin@example.com', 'password' => 'password']);
    $customer = Customer::create(['name' => 'Tracking Customer', 'phone' => '9300000003']);
    $otherCustomer = Customer::create(['name' => 'Other Tracking Customer', 'phone' => '9300000004']);
    $driver = Driver::create(['name' => 'Tracking Driver', 'phone' => '8300000003']);
    $otherDriver = Driver::create(['name' => 'Other Tracking Driver', 'phone' => '8300000004']);

    $tour = Tour::create([
        'title' => 'Channel Tour',
        'slug' => 'channel-tour',
        'duration_days' => 1,
        'duration_nights' => 0,
        'price_per_person' => 1200,
        'child_price' => 600,
        'available_from' => now(),
        'available_to' => now()->addMonth(),
        'is_active' => true,
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addWeek()->toDateString(),
        'return_date' => now()->addWeek()->toDateString(),
        'total_seats' => 12,
        'status' => 'open',
    ]);
    $tourBooking = TourBooking::create([
        'customer_id' => $customer->id,
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 2,
        'number_of_children' => 0,
        'travel_date' => $schedule->departure_date,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'price_per_adult' => 1200,
        'price_per_child' => 600,
        'subtotal' => 2400,
        'total_price' => 2400,
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'payment_method' => 'cash',
    ]);
    TourDriverAssignment::create([
        'tour_schedule_id' => $schedule->id,
        'driver_id' => $driver->id,
        'status' => 'assigned',
    ]);

    $category = CarCategory::create([
        'name' => 'Channel Sedan',
        'slug' => 'channel-sedan',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 1800,
    ]);
    $rental = CarRental::create([
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'car_category_id' => $category->id,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'start_date' => now()->addDays(2)->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
        'number_of_days' => 2,
        'pickup_location' => 'Airport',
        'base_price' => 3600,
        'total_price' => 3600,
        'status' => 'driver_assigned',
        'payment_status' => 'paid',
        'payment_method' => 'cash',
    ]);

    $authorizeTour = broadcastChannelCallback('tour.{bookingId}');
    $authorizeRental = broadcastChannelCallback('rental.{rentalId}');

    foreach ([[$authorizeTour, $tourBooking->id], [$authorizeRental, $rental->id]] as [$authorize, $id]) {
        expect($authorize($customer, $id))->toBeTrue()
            ->and($authorize($driver, $id))->toBeTrue()
            ->and($authorize($admin, $id))->toBeTrue()
            ->and($authorize($otherCustomer, $id))->toBeFalse()
            ->and($authorize($otherDriver, $id))->toBeFalse()
            ->and($authorize($customer, 999999))->toBeFalse();
    }
});

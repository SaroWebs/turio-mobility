<?php

use App\Models\CarCategory;
use App\Models\CarpoolBooking;
use App\Models\CarpoolPolicy;
use App\Models\CarpoolRide;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\Vehicle;
use App\Services\CarpoolService;

function carpoolFixture(array $overrides = []): array
{
    $driver = Driver::create(['name' => 'Carpool Driver', 'phone' => '91'.random_int(100000000, 999999999), 'phone_verified_at' => now(), 'is_active' => true, 'is_approved' => true, 'approved_at' => now(), 'status' => 'active', 'can_long_ride' => true, 'license_expiry' => now()->addYear()]);
    $category = CarCategory::create(['name' => 'Carpool sedan', 'slug' => 'cp-'.uniqid(), 'vehicle_type' => 'sedan', 'seats' => 4, 'base_price_per_day' => 1000, 'is_active' => true]);
    foreach (['driving_license', 'government_id', 'vehicle_rc'] as $type) {
        \App\Models\DriverDocument::create(['driver_id' => $driver->id, 'type' => $type, 'file_path' => 'test/'.$type.'.pdf', 'status' => 'approved']);
    }
    $vehicle = Vehicle::create(['driver_id' => $driver->id, 'car_category_id' => $category->id, 'registration_number' => 'CP'.uniqid(), 'make' => 'Test', 'model' => 'Sedan', 'color' => 'White', 'year' => 2025, 'fuel_type' => 'petrol', 'seats' => 4, 'is_active' => true, 'approval_status' => 'approved']);
    $policy = CarpoolPolicy::create(['region' => 'test-'.uniqid(), 'version' => 1, 'enabled' => true, 'currency' => 'INR', 'rules' => [
        'bounds' => ['south' => 12, 'north' => 15, 'west' => 76, 'east' => 79],
        'fuel_price_minor_per_litre' => 10000, 'consumption_ml_per_km' => ['petrol' => 70], 'max_toll_minor' => 20000,
        'driver_min_bps' => 2500, 'allocation' => 'equal_occupants', 'fee_bps' => 0, 'fee_fixed_minor' => 0,
        'payment_methods' => ['cash', 'online'], 'hold_minutes' => 10, 'approval_minutes' => 120, 'dispute_hours' => 24,
        'no_show_minutes' => 15, 'proximity_m' => 5000, 'min_distance_m' => 20000, 'max_route_factor' => 3,
        'cancellation' => ['free_hours' => 24, 'late_refund_bps' => 5000], 'review_note' => 'Test policy only',
    ]]);
    $data = array_replace(['region' => $policy->region, 'vehicle_id' => $vehicle->id, 'status' => 'published', 'origin' => 'City A', 'destination' => 'City B', 'origin_lat' => 12.9, 'origin_lng' => 77.6, 'destination_lat' => 13.9, 'destination_lng' => 77.6,
        'meeting' => ['pickup' => 'Private gate A', 'dropoff' => 'Private gate B', 'instructions' => 'Call on arrival'], 'departure_at' => now()->addDays(3)->toIso8601String(), 'timezone' => 'Asia/Kolkata',
        'distance_m' => 150000, 'duration_minutes' => 180, 'seats' => 1, 'price_minor' => 10000, 'toll_minor' => 1000, 'booking_mode' => 'instant', 'preferences' => ['smoking' => false, 'pets' => false, 'ac' => true], 'luggage' => 'One bag', 'notes' => 'Private note'], $overrides);
    $ride = app(CarpoolService::class)->save($driver, $data);

    return [$ride, $driver, $vehicle, $policy, $data];
}

function carpoolPassenger(): Customer
{
    return Customer::create(['name' => 'Passenger', 'phone' => '92'.random_int(100000000, 999999999), 'is_active' => true, 'phone_verified_at' => now()]);
}

function carpoolBook(CarpoolRide $ride, ?Customer $passenger = null, string $method = 'cash', ?string $key = null): CarpoolBooking
{
    return app(CarpoolService::class)->book($passenger ?? carpoolPassenger(), $ride->id, ['seats' => 1, 'payment_method' => $method, 'policy_version' => 1, 'price_minor' => $ride->price_minor, 'accept_terms' => true], $key ?? (string) \Illuminate\Support\Str::uuid());
}

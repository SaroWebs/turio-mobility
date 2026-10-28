<?php

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\DriverDocument;
use App\Models\RideBooking;
use App\Models\Vehicle;
use App\Services\DriverDispatchService;
use App\Services\RideEstimateService;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

it('prices selectable point ride vehicle classes independently', function () {
    $service = app(RideEstimateService::class);
    $mini = $service->estimate(12.975, 77.606, 12.935, 77.624, 'point_to_point', false, 1, 'mini');
    $comfort = $service->estimate(12.975, 77.606, 12.935, 77.624, 'point_to_point', false, 1, 'comfort');
    $xl = $service->estimate(12.975, 77.606, 12.935, 77.624, 'point_to_point', false, 1, 'xl');

    expect($mini['pricing']['total'])->toBeLessThan($comfort['pricing']['total'])
        ->and($comfort['pricing']['total'])->toBeLessThan($xl['pricing']['total'])
        ->and($mini['vehicle_class'])->toBe('mini')
        ->and($xl['vehicle_class'])->toBe('xl');
});

it('prices point-to-point sharing by reserved seats and keeps a private benchmark', function () {
    $service = app(RideEstimateService::class);

    $private = $service->estimate(12.9716, 77.5946, 12.9352, 77.6245, 'point_to_point');
    $oneSeat = $service->estimate(12.9716, 77.5946, 12.9352, 77.6245, 'point_to_point', true, 1);
    $twoSeats = $service->estimate(12.9716, 77.5946, 12.9352, 77.6245, 'point_to_point', true, 2);

    expect($oneSeat['sharing']['eligible'])->toBeTrue()
        ->and($oneSeat['sharing']['requested'])->toBeTrue()
        ->and($oneSeat['pricing']['private_subtotal'])->toBe($private['pricing']['subtotal'])
        ->and($oneSeat['pricing']['subtotal'])->toBe(round($private['pricing']['subtotal'] * 0.65, 2))
        ->and($twoSeats['pricing']['subtotal'])->toBe(round($private['pricing']['subtotal'] * 0.80, 2))
        ->and($oneSeat['pricing']['sharing_savings'])->toBeGreaterThan(0.0);
});

it('lets the first customer enable sharing when nearby drivers have sharing off', function () {
    Event::fake();

    $customer = Customer::create([
        'name' => 'First Sharing Customer',
        'phone' => '9000000201',
        'email' => 'sharing-customer@example.com',
        'is_active' => true,
    ]);

    Sanctum::actingAs($customer);

    $response = $this->postJson('/api/customer-app/rides', [
        'service_type' => 'point_to_point',
        'pickup_location' => 'MG Road',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'Indiranagar',
        'dropoff_lat' => 12.9784,
        'dropoff_lng' => 77.6408,
        'scheduled_at' => now()->addDay()->toISOString(),
        'payment_method' => 'cash',
        'sharing_requested' => true,
        'reserved_seats' => 1,
    ]);

    $response->assertCreated()
        ->assertJsonPath('sharing.enabled_by', 'customer')
        ->assertJsonPath('data.ride_mode', 'shared')
        ->assertJsonPath('data.reserved_seats', 1);

    $ride = RideBooking::firstOrFail();

    expect($ride->sharing_requested)->toBeTrue()
        ->and($ride->sharing_enabled_by)->toBe('customer')
        ->and((float) $ride->full_car_fare)->toBeGreaterThan((float) $ride->total_fare)
        ->and((float) $ride->sharing_savings)->toBeGreaterThan(0.0);
});

it('allows a driver to publish sharing preference and seat capacity', function () {
    $driver = Driver::create([
        'name' => 'Sharing Driver',
        'phone' => '8000000201',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);
    $category = CarCategory::create([
        'name' => 'Sharing Sedan', 'slug' => 'sharing-sedan', 'vehicle_type' => 'sedan',
        'seats' => 4, 'base_price_per_day' => 1600, 'is_active' => true,
    ]);
    Vehicle::create([
        'driver_id' => $driver->id, 'car_category_id' => $category->id,
        'registration_number' => 'KA01SH0201', 'make' => 'Tata', 'model' => 'Tigor',
        'year' => 2024, 'color' => 'Blue', 'seats' => 4,
        'is_active' => true, 'approval_status' => 'approved',
    ]);
    foreach (['driving_license', 'government_id', 'vehicle_rc'] as $type) {
        DriverDocument::create([
            'driver_id' => $driver->id,
            'type' => $type,
            'file_path' => "test/{$type}.pdf",
            'status' => 'approved',
        ]);
    }

    Sanctum::actingAs($driver);

    $this->putJson('/api/driver-app/availability', [
        'is_online' => true,
        'is_available' => true,
        'sharing_enabled' => true,
        'sharing_seat_capacity' => 4,
    ])->assertOk()
        ->assertJsonPath('data.sharing_enabled', true)
        ->assertJsonPath('data.sharing_seat_capacity', 4);

    $this->assertDatabaseHas('driver_availabilities', [
        'driver_id' => $driver->id,
        'status' => 'online',
        'sharing_enabled' => true,
        'sharing_seat_capacity' => 4,
    ]);
});

it('prioritizes sharing-enabled drivers for shared requests without excluding others', function () {
    $category = CarCategory::create([
        'name' => 'Shared Ride Sedan', 'slug' => 'shared-ride-sedan', 'vehicle_type' => 'sedan',
        'seats' => 4, 'base_price_per_day' => 1600, 'is_active' => true,
    ]);
    $standardDriver = Driver::create([
        'name' => 'Standard Driver',
        'phone' => '8000000202',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
        'rating' => 4.8,
    ]);
    $sharingDriver = Driver::create([
        'name' => 'Sharing Driver Two',
        'phone' => '8000000203',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
        'rating' => 4.8,
    ]);
    Vehicle::create([
        'driver_id' => $standardDriver->id, 'car_category_id' => $category->id,
        'registration_number' => 'KA01SH0202', 'make' => 'Maruti', 'model' => 'Dzire',
        'year' => 2024, 'color' => 'White', 'seats' => 4,
        'is_active' => true, 'approval_status' => 'approved',
    ]);
    Vehicle::create([
        'driver_id' => $sharingDriver->id, 'car_category_id' => $category->id,
        'registration_number' => 'KA01SH0203', 'make' => 'Honda', 'model' => 'Amaze',
        'year' => 2024, 'color' => 'Silver', 'seats' => 4,
        'is_active' => true, 'approval_status' => 'approved',
    ]);

    DriverAvailability::create([
        'last_updated' => now(),
        'driver_id' => $standardDriver->id,
        'is_available' => true,
        'status' => 'online',
        'sharing_enabled' => false,
        'current_lat' => 12.9716,
        'current_lng' => 77.5946,
    ]);
    DriverAvailability::create([
        'last_updated' => now(),
        'driver_id' => $sharingDriver->id,
        'is_available' => true,
        'status' => 'online',
        'sharing_enabled' => true,
        'sharing_seat_capacity' => 3,
        'current_lat' => 12.9750,
        'current_lng' => 77.5946,
    ]);

    $candidates = app(DriverDispatchService::class)->rankedCandidates(
        'short_ride',
        12.9716,
        77.5946,
        null,
        10,
        null,
        true
    );

    expect($candidates)->toHaveCount(2)
        ->and($candidates->first()->driver_id)->toBe($sharingDriver->id);
});

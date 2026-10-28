<?php

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\Vehicle;
use Laravel\Sanctum\Sanctum;

function marketplaceCategory(): CarCategory
{
    return CarCategory::create([
        'name' => 'Marketplace Sedan',
        'slug' => 'marketplace-sedan',
        'description' => 'Comfortable rental sedan',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 2200,
        'extra_km_charge' => 14,
        'is_active' => true,
    ]);
}

function marketplaceDriver(string $phone): Driver
{
    return Driver::create([
        'name' => 'Rental Driver',
        'phone' => $phone,
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_rental_delivery' => true,
    ]);
}

function marketplaceVehicle(CarCategory $category, Driver $driver, array $overrides = []): Vehicle
{
    return Vehicle::create(array_merge([
        'car_category_id' => $category->id,
        'driver_id' => $driver->id,
        'registration_number' => 'KA01RENT01',
        'make' => 'Toyota',
        'model' => 'Etios',
        'year' => 2024,
        'color' => 'White',
        'fuel_type' => 'petrol',
        'seats' => 4,
        'is_ac' => true,
        'is_active' => true,
        'approval_status' => 'approved',
        'condition' => 'good',
        'is_available_for_rent' => false,
    ], $overrides));
}

it('lets a driver publish an approved vehicle to the rental marketplace', function () {
    $category = marketplaceCategory();
    $driver = marketplaceDriver('8800001001');
    $vehicle = marketplaceVehicle($category, $driver);
    foreach (['driving_license', 'government_id', 'vehicle_rc'] as $type) {
        $driver->documents()->create([
            'type' => $type, 'file_path' => "test/{$type}.pdf", 'status' => 'approved',
        ]);
    }

    $this->getJson('/api/customer-app/public/rental-vehicles')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    Sanctum::actingAs($driver);
    $this->putJson('/api/driver-app/vehicle/rental-availability', [
        'is_available_for_rent' => true,
    ])->assertOk()
        ->assertJsonPath('vehicle.is_available_for_rent', true);

    $this->getJson('/api/customer-app/public/rental-vehicles')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $vehicle->id)
        ->assertJsonPath('data.0.make', 'Toyota');
});

it('books the selected vehicle and rejects overlapping dates', function () {
    $category = marketplaceCategory();
    $driver = marketplaceDriver('8800001002');
    $vehicle = marketplaceVehicle($category, $driver, [
        'registration_number' => 'KA01RENT02',
        'is_available_for_rent' => true,
    ]);
    $customer = Customer::create([
        'name' => 'Rental Customer',
        'email' => 'rental-customer@example.com',
        'phone' => '7700001002',
        'is_active' => true,
    ]);
    Sanctum::actingAs($customer);

    $payload = [
        'vehicle_id' => $vehicle->id,
        'car_category_id' => $category->id,
        'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(4)->toDateString(),
        'pickup_location' => 'Airport',
        'dropoff_location' => 'Airport',
        'payment_method' => 'cash',
    ];

    $this->postJson('/api/customer-app/car-rentals', $payload)
        ->assertCreated()
        ->assertJsonPath('data.vehicle_id', $vehicle->id)
        ->assertJsonPath('data.driver_id', $driver->id)
        ->assertJsonPath('data.status', 'driver_assigned');

    $this->postJson('/api/customer-app/car-rentals', $payload)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'This car or driver is already booked for the selected dates.');
});

it('rejects self drive inputs and cannot start a rental without a driver', function () {
    $category = marketplaceCategory();
    $customer = Customer::create(['name' => 'Family', 'phone' => '9876501234']);
    Sanctum::actingAs($customer);
    $payload = ['car_category_id' => $category->id, 'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(4)->toDateString(), 'pickup_location' => 'Airport', 'payment_method' => 'cash'];
    $this->postJson('/api/customer-app/car-rentals', [...$payload, 'self_drive' => true])->assertUnprocessable();
    $this->postJson('/api/customer-app/car-rentals', $payload)->assertUnprocessable();
    expect(fn () => app(\App\Services\RentalDriverService::class)->assertReady(new \App\Models\CarRental))
        ->toThrow(\Illuminate\Validation\ValidationException::class);
});

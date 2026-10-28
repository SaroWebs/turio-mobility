<?php

use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverInsurancePolicy;
use App\Models\InsurancePolicy;
use App\Models\RideBooking;
use App\Services\InsurancePlanCatalog;
use Laravel\Sanctum\Sanctum;

it('scopes customer insurance policies by customer id', function () {
    $customer = Customer::create(['name' => 'Policy Customer', 'phone' => '9600000001']);
    $otherCustomer = Customer::create(['name' => 'Other Policy Customer', 'phone' => '9600000002']);

    $ownPolicy = InsurancePolicy::create([
        'policy_number' => 'POLICY-OWN',
        'customer_id' => $customer->id,
        'policy_type' => 'comprehensive',
        'premium' => 500,
        'coverage_amount' => 5000,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addYear()->toDateString(),
        'status' => 'active',
    ]);

    InsurancePolicy::create([
        'policy_number' => 'POLICY-OTHER',
        'customer_id' => $otherCustomer->id,
        'policy_type' => 'basic',
        'premium' => 300,
        'coverage_amount' => 3000,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addYear()->toDateString(),
        'status' => 'active',
    ]);

    Sanctum::actingAs($customer);

    $this->getJson('/api/customer-app/insurance/policies')
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $ownPolicy->id)
        ->assertJsonPath('data.0.customer_id', $customer->id);
});

it('rejects driver access to customer insurance policies', function () {
    $driver = Driver::create([
        'name' => 'Insurance Driver',
        'phone' => '8600000001',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);

    Sanctum::actingAs($driver);

    $this->getJson('/api/customer-app/insurance/policies')
        ->assertForbidden()
        ->assertJsonPath('success', false);
});

it('issues server-priced insurance only for a booking owned by the customer', function () {
    config()->set('services.insurance.provider_name', 'Test Licensed Insurer');
    config()->set('services.insurance.provider_policy_url', 'https://insurer.example/policy');

    $customer = Customer::create(['name' => 'Insured Rider', 'phone' => '9600000010']);
    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Point A',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'Point B',
        'dropoff_lat' => 12.9816,
        'dropoff_lng' => 77.6046,
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 10,
        'total_fare' => 250,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    Sanctum::actingAs($customer);

    $response = $this->postJson('/api/customer-app/insurance/policies', [
        'plan_code' => 'ride_protect',
        'service_type' => 'ride',
        'booking_id' => $ride->id,
        'terms_accepted' => true,
        'terms_version' => InsurancePlanCatalog::TERMS_VERSION,
        'premium' => 1,
        'coverage_amount' => 99999999,
    ])->assertCreated()
        ->assertJsonPath('data.premium', 49)
        ->assertJsonPath('data.coverage_amount', 100000)
        ->assertJsonPath('data.provider_name', 'Test Licensed Insurer');

    $policyId = $response->json('data.id');
    $this->putJson("/api/customer-app/insurance/policies/{$policyId}", [
        'premium' => 1,
        'coverage_amount' => 99999999,
    ])->assertStatus(409);
});

it('does not issue insurance without a configured provider and policy wording', function () {
    config()->set('services.insurance.provider_name', null);
    config()->set('services.insurance.provider_policy_url', null);

    $customer = Customer::create(['name' => 'Unconfigured Rider', 'phone' => '9600000011']);
    Sanctum::actingAs($customer);

    $this->postJson('/api/customer-app/insurance/policies', [
        'plan_code' => 'ride_protect',
        'service_type' => 'ride',
        'booking_id' => 1,
        'terms_accepted' => true,
        'terms_version' => InsurancePlanCatalog::TERMS_VERSION,
    ])->assertStatus(503);
});

it('shows drivers only their verified insurance records', function () {
    $driver = Driver::create(['name' => 'Covered Driver', 'phone' => '8600000010', 'status' => 'active', 'is_active' => true, 'is_approved' => true]);
    $other = Driver::create(['name' => 'Other Covered Driver', 'phone' => '8600000011', 'status' => 'active', 'is_active' => true, 'is_approved' => true]);

    DriverInsurancePolicy::create([
        'driver_id' => $driver->id, 'policy_number' => 'DRV-POLICY-OWN', 'product_code' => 'commercial_driver',
        'provider_name' => 'Test Licensed Insurer', 'coverage_amount' => 500000, 'premium' => 1500,
        'start_date' => today(), 'end_date' => today()->addYear(), 'status' => 'active',
        'terms_version' => '2026-07-22', 'verified_at' => now(),
    ]);
    DriverInsurancePolicy::create([
        'driver_id' => $other->id, 'policy_number' => 'DRV-POLICY-OTHER', 'product_code' => 'commercial_driver',
        'provider_name' => 'Other Insurer', 'coverage_amount' => 500000,
        'start_date' => today(), 'end_date' => today()->addYear(), 'status' => 'active',
        'terms_version' => '2026-07-22', 'verified_at' => now(),
    ]);

    Sanctum::actingAs($driver);
    $this->getJson('/api/driver-app/insurance/policies')
        ->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.policy_number', 'DRV-POLICY-OWN')
        ->assertJsonPath('data.0.is_active', true);
});

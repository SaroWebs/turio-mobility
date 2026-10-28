<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Services\RideEstimateService;

class SharedRideRelabelTest extends TestCase
{
    use RefreshDatabase;

    public function test_estimate_with_sharing_returns_flexible_fare_label()
    {
        $estimateService = app(RideEstimateService::class);
        $result = $estimateService->estimate(
            12.9716, 77.5946, 12.9352, 77.6245, 'point_to_point', true
        );

        $this->assertEquals('Flexible Fare', $result['fare_type_label']);
        $this->assertEquals('flexible', $result['fare_type']);
        $this->assertNotNull($result['sharing_disclaimer']);
        // Math remains unchanged
        $this->assertTrue($result['pricing']['sharing_discount_percent'] > 0);
    }

    public function test_estimate_private_ride_returns_private_label()
    {
        $estimateService = app(RideEstimateService::class);
        $result = $estimateService->estimate(
            12.9716, 77.5946, 12.9352, 77.6245, 'point_to_point', false
        );

        $this->assertEquals('Private Ride', $result['fare_type_label']);
        $this->assertEquals('private', $result['fare_type']);
        $this->assertNull($result['sharing_disclaimer']);
    }

    public function test_booking_with_sharing_stores_ride_mode_as_shared()
    {
        $customer = Customer::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'phone' => '1234567890',
            'password' => bcrypt('password'),
        ]);
        
        $response = $this->actingAs($customer)->postJson('/api/customer-app/rides', [
            'service_type' => 'point_to_point',
            'pickup_location' => 'Pickup',
            'pickup_lat' => 12.9716,
            'pickup_lng' => 77.5946,
            'dropoff_location' => 'Dropoff',
            'dropoff_lat' => 12.9352,
            'dropoff_lng' => 77.6245,
            'scheduled_at' => now()->addMinutes(10)->toIso8601String(),
            'payment_method' => 'cash',
            'sharing_requested' => true,
        ]);

        $response->assertStatus(201);
        $this->assertEquals('shared', $response->json('data.ride_mode'));
        $this->assertNotNull($response->json('fare_disclaimer'));
    }
}

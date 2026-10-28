<?php

namespace Tests\Feature;

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\Setting;
use App\Models\Wallet;
use App\Services\CommissionService;
use App\Services\DriverDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverCashPaymentTest extends TestCase
{
    use RefreshDatabase;

    private Driver $driver;
    private Customer $customer;
    private CarCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        Setting::updateOrCreate(['key' => 'driver.minimum_topup_minor'], ['value' => '50000']);
        Setting::updateOrCreate(['key' => 'driver.dispatch_eligible_balance_minor'], ['value' => '10000']);
        Setting::updateOrCreate(['key' => 'driver.warning_balance_minor'], ['value' => '50000']);
        Setting::updateOrCreate(['key' => 'commission.ride.default'], ['value' => '0.025']);

        $this->category = CarCategory::firstOrCreate(['slug' => 'sedan'], [
            'name' => 'Sedan', 'vehicle_type' => 'sedan', 'seats' => 4,
        ]);

        $this->driver = Driver::forceCreate([
            'name' => 'Cash Driver',
            'email' => 'cashdriver@example.com',
            'phone' => '9876543210',
            'password' => bcrypt('password'),
            'is_approved' => true,
            'is_active' => true,
            'status' => 'active',
            'can_short_ride' => true,
            'funding_eligible' => true,
        ]);

        $this->driver->vehicle()->create([
            'car_category_id' => $this->category->id,
            'registration_number' => 'DL01AB1234',
            'make' => 'Maruti',
            'model' => 'Dzire',
            'year' => 2022,
            'color' => 'white',
            'fuel_type' => 'cng',
            'seats' => 4,
            'is_ac' => true,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->customer = Customer::create([
            'name' => 'Customer Jane',
            'phone' => '9123456780',
        ]);
    }

    public function test_cash_ride_completion_deducts_system_charge_from_driver_wallet()
    {
        // Driver starts with 1,000 INR (100,000 paise) in wallet
        $wallet = Wallet::create([
            'owner_type' => Driver::class,
            'owner_id' => $this->driver->id,
            'balance_minor' => 100000,
            'balance' => 1000.00,
            'currency' => 'INR',
            'is_active' => true,
        ]);

        // Ride with total fare = 500 INR, payment method = cash
        $ride = RideBooking::forceCreate([
            'booking_number' => 'RIDE-CASH-101',
            'customer_id' => $this->customer->id,
            'customer_name' => $this->customer->name,
            'customer_phone' => $this->customer->phone,
            'driver_id' => $this->driver->id,
            'car_category_id' => $this->category->id,
            'vehicle_id' => $this->driver->vehicle->id,
            'service_type' => 'point_to_point',
            'scheduled_at' => now(),
            'status' => 'in_transit',
            'payment_status' => 'pending',
            'payment_method' => 'cash',
            'total_fare' => 500.00,
            'pickup_location' => 'Point A',
            'dropoff_location' => 'Point B',
        ]);

        // Driver completes cash ride
        $response = $this->actingAs($this->driver)
            ->postJson("/api/driver-app/tracking/ride/{$ride->id}/status", [
                'status' => 'completed',
                'cash_received' => true,
            ]);

        $response->assertSuccessful();

        $ride->refresh();
        $this->assertEquals('completed', $ride->status);
        $this->assertEquals('paid', $ride->payment_status);

        // System charge is 2.5% of 500 = 12.50 INR (1,250 paise)
        // Driver share / net income is 500 - 12.50 = 487.50 INR
        $this->assertEquals(12.50, (float) $ride->commission_amount);
        $this->assertEquals(487.50, (float) $ride->driver_share);

        // Driver's wallet should have deducted the 12.50 INR system charge
        // 1000 - 12.50 = 987.50 INR (98,750 paise)
        $wallet->refresh();
        $this->assertEquals(987.50, (float) $wallet->balance);
        $this->assertEquals(98750, $wallet->balance_minor);

        // Check wallet transaction
        $transaction = $wallet->transactions()->latest('id')->first();
        $this->assertNotNull($transaction);
        $this->assertEquals('debit', $transaction->type);
        $this->assertEquals(12.50, (float) $transaction->amount);
        $this->assertEquals('system_charge', $transaction->reference_type);
    }

    public function test_online_ride_completion_credits_net_earnings_to_driver_wallet()
    {
        // Driver starts with 200 INR (20,000 paise) in wallet
        $wallet = Wallet::create([
            'owner_type' => Driver::class,
            'owner_id' => $this->driver->id,
            'balance_minor' => 20000,
            'balance' => 200.00,
            'currency' => 'INR',
            'is_active' => true,
        ]);

        // Online paid ride: total fare = 400 INR
        $ride = RideBooking::forceCreate([
            'booking_number' => 'RIDE-ONLINE-102',
            'customer_id' => $this->customer->id,
            'customer_name' => $this->customer->name,
            'customer_phone' => $this->customer->phone,
            'driver_id' => $this->driver->id,
            'car_category_id' => $this->category->id,
            'vehicle_id' => $this->driver->vehicle->id,
            'service_type' => 'point_to_point',
            'scheduled_at' => now(),
            'status' => 'in_transit',
            'payment_status' => 'paid',
            'payment_method' => 'online',
            'total_fare' => 400.00,
            'pickup_location' => 'Point A',
            'dropoff_location' => 'Point B',
        ]);

        $response = $this->actingAs($this->driver)
            ->postJson("/api/driver-app/tracking/ride/{$ride->id}/status", [
                'status' => 'completed',
            ]);

        $response->assertSuccessful();

        $ride->refresh();
        $this->assertEquals('completed', $ride->status);

        // System charge is 2.5% of 400 = 10.00 INR
        // Driver share / net income is 400 - 10 = 390.00 INR
        $this->assertEquals(10.00, (float) $ride->commission_amount);
        $this->assertEquals(390.00, (float) $ride->driver_share);

        // Driver's wallet should be credited 390.00 INR: 200 + 390 = 590.00 INR (59,000 paise)
        $wallet->refresh();
        $this->assertEquals(590.00, (float) $wallet->balance);
        $this->assertEquals(59000, $wallet->balance_minor);

        $transaction = $wallet->transactions()->latest('id')->first();
        $this->assertEquals('credit', $transaction->type);
        $this->assertEquals(390.00, (float) $transaction->amount);
        $this->assertEquals('driver_earning', $transaction->reference_type);
    }

    public function test_driver_must_topup_minimum_500_rs()
    {
        // Try top-up of 400 INR (40,000 paise) -> should be rejected
        $response = $this->actingAs($this->driver)
            ->postJson('/api/driver-app/top-up', [
                'amount_minor' => 40000,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['amount_minor']);

        // Try top-up via general wallet endpoint of 499 INR -> should be rejected
        $response2 = $this->actingAs($this->driver)
            ->postJson('/api/customer-app/wallet/topup/order', [
                'amount' => 499,
            ]);

        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors(['amount']);
    }

    public function test_driver_with_balance_less_than_100_cannot_go_online()
    {
        // Driver wallet has 80 INR (8,000 paise)
        Wallet::create([
            'owner_type' => Driver::class,
            'owner_id' => $this->driver->id,
            'balance_minor' => 8000,
            'balance' => 80.00,
            'currency' => 'INR',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->driver)
            ->putJson('/api/driver-app/availability', [
                'is_online' => true,
                'is_available' => true,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('below ₹100', $response->json('message'));
    }

    public function test_driver_with_balance_less_than_100_fails_dispatch_eligibility()
    {
        // Driver wallet has 90 INR (9,000 paise)
        Wallet::create([
            'owner_type' => Driver::class,
            'owner_id' => $this->driver->id,
            'balance_minor' => 9000,
            'balance' => 90.00,
            'currency' => 'INR',
            'is_active' => true,
        ]);

        $dispatch = app(DriverDispatchService::class);
        $failures = $dispatch->eligibilityFailures($this->driver, 'short_ride');

        $this->assertContains('Driver wallet balance is below the minimum required for dispatch.', $failures);
    }

    public function test_driver_funding_status_indicates_warning_when_below_500()
    {
        // Driver wallet has 300 INR (30,000 paise) -> between 100 and 500
        Wallet::create([
            'owner_type' => Driver::class,
            'owner_id' => $this->driver->id,
            'balance_minor' => 30000,
            'balance' => 300.00,
            'currency' => 'INR',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->driver)
            ->getJson('/api/driver-app/funding-status');

        $response->assertSuccessful();
        $this->assertTrue($response->json('data.needs_topup_warning'));
        $this->assertTrue($response->json('data.is_dispatch_eligible'));
    }

    public function test_driver_wallet_topup_simulation_credits_balance_and_activates_eligibility()
    {
        $this->driver->update(['funding_eligible' => false]);

        // 1. Create top-up order
        $orderResponse = $this->actingAs($this->driver)
            ->postJson('/api/driver-app/wallet/topup/order', [
                'amount' => 500,
            ]);

        $orderResponse->assertSuccessful();
        $this->assertTrue($orderResponse->json('data.is_simulation'));
        $orderId = $orderResponse->json('data.order_id');
        $this->assertNotEmpty($orderId);

        // 2. Verify demo simulation payment
        $verifyResponse = $this->actingAs($this->driver)
            ->postJson('/api/driver-app/wallet/topup/verify', [
                'razorpay_order_id' => $orderId,
                'razorpay_payment_id' => 'pay_demo_12345',
                'razorpay_signature' => 'sig_demo_12345',
            ]);

        $verifyResponse->assertSuccessful();
        $this->assertEquals(500, (float) $verifyResponse->json('data.wallet.balance'));
        $this->assertEquals(500, $verifyResponse->json('data.amount'));

        // Driver must now be funding_eligible
        $this->driver->refresh();
        $this->assertTrue((bool) $this->driver->funding_eligible);
    }
}


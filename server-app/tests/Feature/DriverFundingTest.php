<?php

namespace Tests\Feature;

use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\Setting;
use App\Services\DriverDispatchService;
use App\Services\RazorpayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class DriverFundingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Setting::updateOrCreate(['key' => 'driver.minimum_topup_minor'], ['value' => '100000']);
        Setting::updateOrCreate(['key' => 'driver.dispatch_eligible_balance_minor'], ['value' => '50000']);
    }

    private function createDriver(array $attrs = [])
    {
        return Driver::forceCreate(array_merge([
            'name' => 'Test Driver',
            'email' => 'driver@example.com',
            'phone' => '1234567890',
            'password' => bcrypt('password'),
            'is_approved' => true,
            'is_active' => true,
            'status' => 'active',
            'can_short_ride' => true,
            'funding_eligible' => false,
        ], $attrs));
    }

    public function test_driver_without_funding_cannot_be_dispatched()
    {
        $driver = $this->createDriver(['funding_eligible' => false]);

        $dispatchService = app(DriverDispatchService::class);
        $failures = $dispatchService->eligibilityFailures($driver, 'short_ride');

        $this->assertContains('Driver wallet balance is below the minimum required for dispatch.', $failures);
    }

    public function test_driver_with_sufficient_balance_passes_eligibility()
    {
        $driver = $this->createDriver(['funding_eligible' => true]);

        $category = \App\Models\CarCategory::firstOrCreate(['slug' => 'sedan'], [
            'name' => 'Sedan', 'vehicle_type' => 'sedan', 'seats' => 4,
        ]);

        $driver->vehicle()->create([
            'car_category_id' => $category->id,
            'registration_number' => 'AB1234',
            'make' => 'Toyota',
            'model' => 'Corolla',
            'year' => 2020,
            'color' => 'red',
            'fuel_type' => 'petrol',
            'seats' => 4,
            'is_ac' => true,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $wallet = $driver->wallet()->create(['balance_minor' => 60000, 'balance' => 600, 'currency' => 'INR']);

        $dispatchService = app(DriverDispatchService::class);
        $failures = $dispatchService->eligibilityFailures($driver, 'short_ride');

        $this->assertNotContains('Driver wallet balance is below the minimum required for dispatch.', $failures);
    }

    public function test_zero_ongoing_balance_still_requires_verified_onboarding()
    {
        Setting::updateOrCreate(['key' => 'driver.dispatch_eligible_balance_minor'], ['value' => '0']);

        $driver = $this->createDriver(['funding_eligible' => false]);

        $dispatchService = app(DriverDispatchService::class);
        $failures = $dispatchService->eligibilityFailures($driver, 'short_ride');

        $this->assertContains('Driver wallet balance is below the minimum required for dispatch.', $failures);
    }

    public function test_topup_payment_creates_order_and_activates_funding()
    {
        $driver = $this->createDriver(['funding_eligible' => false]);

        $this->mock(RazorpayService::class, function (MockInterface $mock) {
            $mock->shouldReceive('createOrder')->once()->andReturn(['id' => 'order_123', 'amount' => 1000]);
            $mock->shouldReceive('getClientConfig')->andReturn([]);
            $mock->shouldReceive('verifySignature')->once()->andReturn(true);
            $mock->shouldReceive('fetchPayment')->once()->andReturn(['id' => 'pay_123', 'order_id' => 'order_123', 'status' => 'captured', 'amount' => 100000, 'currency' => 'INR']);
            $mock->shouldReceive('fetchOrder')->once()->andReturn(['id' => 'order_123', 'amount' => 100000, 'currency' => 'INR']);
        });

        $response = $this->actingAs($driver)->postJson('/api/driver-app/top-up', [
            'amount_minor' => 100000,
        ]);

        $response->assertSuccessful();
        $orderId = $response->json('data.order_id');
        $this->assertEquals('order_123', $orderId);

        $verifyResponse = $this->actingAs($driver)->postJson('/api/driver-app/top-up/verify', [
            'razorpay_order_id' => 'order_123',
            'razorpay_payment_id' => 'pay_123',
            'razorpay_signature' => 'valid_sig',
        ]);

        $verifyResponse->assertSuccessful();
        $this->assertTrue($driver->fresh()->funding_eligible);
        $this->assertNotNull($driver->fresh()->funding_activated_at);
        $this->assertEquals(100000, $driver->fresh()->getWalletBalanceMinor());
    }

    public function test_ongoing_eligibility_check_works()
    {
        $driver = $this->createDriver(['funding_eligible' => true]);

        $driver->wallet()->create(['balance_minor' => 40000, 'balance' => 400, 'currency' => 'INR']);

        $dispatchService = app(DriverDispatchService::class);
        $failures = $dispatchService->eligibilityFailures($driver, 'short_ride');

        // Although funding_eligible is true, balance is below 50000
        $this->assertContains('Driver wallet balance is below the minimum required for dispatch.', $failures);
    }

    public function test_withdrawal_below_threshold_does_not_disable_existing_active_trips()
    {
        $driver = $this->createDriver(['funding_eligible' => true]);

        $wallet = $driver->wallet()->create(['balance_minor' => 100000, 'balance' => 1000, 'currency' => 'INR']);

        $customer = \App\Models\Customer::create(['name' => 'John', 'phone' => '1231231234']);

        // Active trip
        $booking = RideBooking::forceCreate([
            'driver_id' => $driver->id,
            'customer_id' => $customer->id,
            'customer_name' => 'John',
            'customer_phone' => '1231231234',
            'booking_number' => 'BK123',
            'status' => 'in_transit',
            'service_type' => 'point_to_point',
            'pickup_location' => 'A',
            'dropoff_location' => 'B',
            'scheduled_at' => now(),
        ]);

        // Withdraw
        $wallet->debit(600, 'Withdrawal', 'withdrawal', 'wd_123', 'wd_key_123');
        $this->assertEquals(40000, $wallet->fresh()->balance_minor);

        // Ensure booking is unaffected
        $this->assertEquals('in_transit', $booking->fresh()->status);
        $this->assertEquals($driver->id, $booking->fresh()->driver_id);
    }

    public function test_manual_credit_does_not_satisfy_verified_onboarding()
    {
        $driver = $this->createDriver();
        $driver->wallet()->create(['balance_minor' => 100000, 'balance' => 1000, 'currency' => 'INR']);
        $this->assertContains('Driver wallet balance is below the minimum required for dispatch.',
            app(DriverDispatchService::class)->eligibilityFailures($driver, 'short_ride'));
    }

    public function test_capture_replay_and_ownership_are_enforced()
    {
        $driver = $this->createDriver();
        $order = app(\App\Services\PaymentService::class)->createOrder(100000, null, $driver,
            ['provider_order_id' => 'order_secure', 'notes' => ['purpose' => 'driver_topup']]);
        $capture = ['id' => 'pay_secure', 'order_id' => 'order_secure', 'amount' => 100000, 'currency' => 'INR', 'status' => 'captured'];
        $service = app(\App\Services\DriverFundingService::class);
        $first = $service->capture($order, $capture);
        $second = $service->capture($order, $capture);
        $this->assertEquals($first->id, $second->id);
        $this->assertEquals(100000, $driver->fresh()->getWalletBalanceMinor());
        $this->assertEquals(1, \App\Models\Payment::count());
        $other = $this->createDriver(['phone' => '9999990000', 'email' => 'other@example.com']);
        $this->expectException(\Illuminate\Database\Eloquent\ModelNotFoundException::class);
        $service->verifyTopUp($other, 'order_secure', 'pay_secure', 'signature', 'different-key');
    }

    public function test_wrong_currency_is_rejected_without_credit()
    {
        $driver = $this->createDriver();
        $order = app(\App\Services\PaymentService::class)->createOrder(100000, null, $driver,
            ['provider_order_id' => 'order_currency', 'notes' => ['purpose' => 'driver_topup']]);
        try {
            app(\App\Services\DriverFundingService::class)->capture($order,
                ['id' => 'pay_currency', 'order_id' => 'order_currency', 'amount' => 100000, 'currency' => 'USD', 'status' => 'captured']);
            $this->fail('Expected currency validation.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $error) {
            $this->assertEquals(422, $error->getStatusCode());
        }
        $this->assertEquals(0, \App\Models\Payment::count());
        $this->assertEquals(0, $driver->getWalletBalanceMinor());
    }
}

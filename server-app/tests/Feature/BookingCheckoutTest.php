<?php

use App\Models\Customer;
use App\Models\Payment;
use App\Models\RideBooking;
use App\Services\RazorpayService;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Event::fake([\App\Events\BookingLifecycleNotification::class]);
    config(['services.razorpay.booking_checkout_enabled' => true, 'services.razorpay.key' => 'test-key', 'services.razorpay.secret' => 'test-secret', 'services.razorpay.webhook_secret' => 'test-webhook']);
    $this->customer = Customer::create(['name' => 'Checkout customer', 'phone' => '9100011199']);
    $this->ride = RideBooking::create(['customer_id' => $this->customer->id, 'customer_name' => 'Checkout customer', 'customer_phone' => $this->customer->phone,
        'service_type' => 'point_to_point', 'pickup_location' => 'A', 'dropoff_location' => 'B', 'scheduled_at' => now()->addMinute(),
        'request_expires_at' => now()->addMinutes(10), 'total_fare' => 120.25, 'status' => 'pending', 'payment_status' => 'pending', 'payment_method' => 'cash']);
    Sanctum::actingAs($this->customer);
    $this->url = '/api/customer-app/booking-payments/ride/'.$this->ride->id;
});

function checkoutGateway(): \Mockery\MockInterface
{
    $mock = Mockery::mock(RazorpayService::class);
    app()->instance(RazorpayService::class, $mock);

    return $mock;
}

it('creates and resumes one provider order without trusting a client amount', function () {
    checkoutGateway()->shouldReceive('createOrder')->once()->with(120.25, Mockery::type('string'), Mockery::type('array'))
        ->andReturn(['id' => 'order_checkout1', 'amount' => 12025, 'currency' => 'INR']);
    $this->postJson($this->url.'/order', ['amount' => 1])->assertOk()->assertJsonPath('data.amount_minor', 12025);
    $this->postJson($this->url.'/order')->assertOk()->assertJsonPath('data.order_id', 'order_checkout1');
    expect($this->ride->paymentOrders()->count())->toBe(1);
    expect($this->ride->fresh()->payment_status)->toBe('pending');
});

it('preserves an uncertain intent and refuses to create another provider order', function () {
    checkoutGateway()->shouldReceive('createOrder')->once()->andThrow(new RuntimeException('timeout'));
    $this->postJson($this->url.'/order')->assertStatus(503);
    $this->postJson($this->url.'/order')->assertStatus(409);
    expect($this->ride->paymentOrders()->first()->notes['checkout_state'])->toBe('reconciliation_required');
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.checkout_state', 'reconciliation_required')->assertJsonPath('data.can_pay', false);
});

it('enforces ownership and the release gate before contacting the gateway', function () {
    checkoutGateway()->shouldNotReceive('createOrder');
    config(['services.razorpay.booking_checkout_enabled' => false]);
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.checkout_state', 'unavailable')->assertJsonPath('data.can_pay', false);
    $this->postJson($this->url.'/order')->assertStatus(503);
    $other = Customer::create(['name' => 'Other', 'phone' => '9100011198']);
    Sanctum::actingAs($other);
    $this->getJson($this->url)->assertNotFound();
    $this->postJson($this->url.'/order')->assertNotFound();
});

it('rejects closed and expired bookings before creating an order', function () {
    checkoutGateway()->shouldNotReceive('createOrder');
    $this->ride->update(['request_expires_at' => now()->subSecond()]);
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.checkout_state', 'closed')->assertJsonPath('data.can_pay', false);
    $this->postJson($this->url.'/order')->assertStatus(409);
    $this->ride->update(['status' => 'cancelled']);
    $this->postJson($this->url.'/order')->assertStatus(409);
});

it('returns final payment feedback even when checkout has been disabled', function (string $paymentStatus) {
    config(['services.razorpay.booking_checkout_enabled' => false]);
    $this->ride->update(['payment_status' => $paymentStatus]);
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.checkout_state', $paymentStatus)
        ->assertJsonPath('data.can_pay', false)->assertJsonStructure(['data' => ['status_message']]);
})->with(['paid', 'refunded']);

it('blocks another payment while a refund requires review', function () {
    $this->ride->refunds()->create(['customer_id' => $this->customer->id, 'amount' => 120.25,
        'cancellation_fee' => 0, 'method' => 'card', 'status' => 'pending', 'reason' => 'Capture requires review']);
    checkoutGateway()->shouldNotReceive('createOrder');
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.checkout_state', 'refund_pending')->assertJsonPath('data.can_pay', false);
    $this->postJson($this->url.'/order')->assertStatus(409);
});

it('offers a retry only for a known failed order and reuses that order', function () {
    checkoutGateway()->shouldReceive('createOrder')->once()->andReturn(['id' => 'order_checkout1', 'amount' => 12025, 'currency' => 'INR']);
    $this->postJson($this->url.'/order')->assertOk();
    $this->ride->paymentOrders()->first()->markFailed();
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.checkout_state', 'retryable')->assertJsonPath('data.can_pay', true);
    $this->postJson($this->url.'/order')->assertOk()->assertJsonPath('data.order_id', 'order_checkout1');
});

it('verifies capture once and never treats an authorized payment as paid', function () {
    $gateway = checkoutGateway();
    $gateway->shouldReceive('createOrder')->once()->andReturn(['id' => 'order_checkout1', 'amount' => 12025, 'currency' => 'INR']);
    $this->postJson($this->url.'/order')->assertOk();
    $payload = ['razorpay_order_id' => 'order_checkout1', 'razorpay_payment_id' => 'pay_checkout1', 'razorpay_signature' => str_repeat('a', 64)];
    $gateway->shouldReceive('verifySignature')->times(3)->andReturn(true);
    $payment = ['id' => 'pay_checkout1', 'order_id' => 'order_checkout1', 'amount' => 12025, 'currency' => 'INR', 'method' => 'upi'];
    $gateway->shouldReceive('fetchPayment')->times(3)->andReturn([...$payment, 'status' => 'authorized'], [...$payment, 'status' => 'captured'], [...$payment, 'status' => 'captured']);
    $this->postJson($this->url.'/verify', $payload)->assertStatus(202);
    expect($this->ride->fresh()->payment_status)->toBe('pending');
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.checkout_state', 'awaiting_capture')->assertJsonPath('data.can_pay', false);
    $this->postJson($this->url.'/order')->assertStatus(409);
    $this->postJson($this->url.'/verify', $payload)->assertOk()->assertJsonPath('data.payment_status', 'paid');
    $this->postJson($this->url.'/verify', $payload)->assertOk();
    expect(Payment::count())->toBe(1);
    expect(\App\Models\LedgerEntry::count())->toBe(2);
});

it('rejects a validly signed capture with the wrong amount', function () {
    $gateway = checkoutGateway();
    $gateway->shouldReceive('createOrder')->once()->andReturn(['id' => 'order_checkout1', 'amount' => 12025, 'currency' => 'INR']);
    $this->postJson($this->url.'/order')->assertOk();
    $gateway->shouldReceive('verifySignature')->once()->andReturn(true);
    $gateway->shouldReceive('fetchPayment')->once()->andReturn(['id' => 'pay_checkout1', 'order_id' => 'order_checkout1', 'amount' => 1, 'currency' => 'INR', 'status' => 'captured']);
    $this->postJson($this->url.'/verify', ['razorpay_order_id' => 'order_checkout1', 'razorpay_payment_id' => 'pay_checkout1', 'razorpay_signature' => str_repeat('a', 64)])->assertUnprocessable();
    expect(Payment::count())->toBe(0);
});

it('requires a valid checkout signature before fetching payment details', function () {
    $gateway = checkoutGateway();
    $gateway->shouldReceive('createOrder')->once()->andReturn(['id' => 'order_checkout1', 'amount' => 12025, 'currency' => 'INR']);
    $this->postJson($this->url.'/order')->assertOk();
    $gateway->shouldReceive('verifySignature')->once()->andReturn(false);
    $gateway->shouldNotReceive('fetchPayment');
    $this->postJson($this->url.'/verify', ['razorpay_order_id' => 'order_checkout1', 'razorpay_payment_id' => 'pay_checkout1', 'razorpay_signature' => str_repeat('a', 64)])->assertUnprocessable();
    expect(Payment::count())->toBe(0);
});

it('recovers uncertain orders only after verifying their receipt amount and intent', function () {
    $gateway = checkoutGateway();
    $gateway->shouldReceive('createOrder')->once()->andThrow(new RuntimeException('timeout'));
    $this->postJson($this->url.'/order')->assertStatus(503);
    $order = $this->ride->paymentOrders()->first();
    $provider = ['id' => 'order_recovered', 'receipt' => $order->order_number, 'amount' => 12025, 'currency' => 'INR', 'notes' => ['payment_order_id' => (string) $order->id]];
    $gateway->shouldReceive('fetchOrder')->twice()->with('order_recovered')->andReturn([...$provider, 'amount' => 1], $provider);
    $this->artisan('booking-payments:reconcile-order', ['intent' => $order->id, 'provider_order' => 'order_recovered'])->assertFailed();
    expect($order->fresh()->provider_order_id)->toBeNull();
    $this->artisan('booking-payments:reconcile-order', ['intent' => $order->id, 'provider_order' => 'order_recovered'])->assertSuccessful();
    $this->postJson($this->url.'/order')->assertOk()->assertJsonPath('data.order_id', 'order_recovered');
    expect($this->ride->fresh()->payment_status)->toBe('pending');
});

it('uses the same checkout verification for tour and rental bookings', function (string $kind) {
    $base = ['customer_id' => $this->customer->id, 'customer_name' => $this->customer->name,
        'customer_phone' => $this->customer->phone, 'total_price' => 120.25,
        'status' => 'pending', 'payment_status' => 'pending', 'payment_method' => 'cash'];
    if ($kind === 'tour') {
        $tour = \App\Models\Tour::create(['title' => 'Checkout tour', 'slug' => 'checkout-tour', 'duration_days' => 1,
            'duration_nights' => 0, 'price_per_person' => 120.25, 'is_active' => true]);
        $schedule = \App\Models\TourSchedule::create(['tour_id' => $tour->id, 'departure_date' => now()->addWeek(),
            'return_date' => now()->addWeek(), 'departure_time' => '09:00', 'total_seats' => 4, 'reserved_seats' => 1, 'booked_seats' => 0, 'status' => 'open']);
        $booking = \App\Models\TourBooking::create([...$base, 'tour_id' => $tour->id, 'tour_schedule_id' => $schedule->id,
            'number_of_adults' => 1, 'number_of_children' => 0, 'travel_date' => $schedule->departure_date,
            'price_per_adult' => 120.25, 'price_per_child' => 0, 'subtotal' => 120.25, 'hold_expires_at' => now()->addMinutes(30)]);
    } else {
        $category = \App\Models\CarCategory::create(['name' => 'Checkout car', 'slug' => 'checkout-car', 'vehicle_type' => 'sedan', 'seats' => 4, 'base_price_per_day' => 120.25]);
        $booking = \App\Models\CarRental::create([...$base, 'car_category_id' => $category->id, 'start_date' => now()->addDay(),
            'end_date' => now()->addDay(), 'number_of_days' => 1, 'pickup_location' => 'Airport', 'base_price' => 120.25]);
    }
    $url = '/api/customer-app/booking-payments/'.$kind.'/'.$booking->id;
    $gateway = checkoutGateway();
    $gateway->shouldReceive('createOrder')->once()->andReturn(['id' => 'order_checkout1', 'amount' => 12025, 'currency' => 'INR']);
    $this->postJson($url.'/order')->assertOk();
    $gateway->shouldReceive('verifySignature')->twice()->andReturn(true);
    $gateway->shouldReceive('fetchPayment')->twice()->andReturn(['id' => 'pay_checkout1', 'order_id' => 'order_checkout1',
        'amount' => 12025, 'currency' => 'INR', 'status' => 'captured', 'method' => 'card']);
    $payload = ['razorpay_order_id' => 'order_checkout1', 'razorpay_payment_id' => 'pay_checkout1', 'razorpay_signature' => str_repeat('a', 64)];
    $this->postJson($url.'/verify', $payload)->assertOk()->assertJsonPath('data.payment_status', 'paid');
    $this->postJson($url.'/verify', $payload)->assertOk();
    expect($booking->payments()->count())->toBe(1);
    if ($kind === 'tour') {
        expect($booking->fresh()->status)->toBe('confirmed');
        expect((int) $schedule->fresh()->reserved_seats)->toBe(0);
        expect((int) $schedule->fresh()->booked_seats)->toBe(1);
    }
})->with(['tour', 'rental']);

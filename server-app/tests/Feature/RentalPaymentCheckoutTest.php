<?php

use App\Events\BookingLifecycleNotification;
use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\PaymentOrder;
use App\Models\Vehicle;
use App\Services\RazorpayService;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Event::fake([BookingLifecycleNotification::class]);
    config([
        'services.razorpay.booking_checkout_enabled' => true,
        'services.razorpay.key' => 'rzp_test_key_123',
        'services.razorpay.secret' => 'rzp_test_secret_123',
        'services.razorpay.webhook_secret' => 'rzp_test_webhook_123',
    ]);

    $this->customer = Customer::create([
        'name' => 'Rental Customer',
        'email' => 'rental.customer@example.com',
        'phone' => '9988776655',
        'is_active' => true,
    ]);

    $this->category = CarCategory::create([
        'name' => 'Premium SUV',
        'slug' => 'premium-suv',
        'vehicle_type' => 'suv',
        'seats' => 7,
        'base_price_per_day' => 3000,
        'included_km_per_day' => 100,
        'extra_km_charge' => 15,
        'is_active' => true,
    ]);

    $this->driver = Driver::create([
        'name' => 'Driver Singh',
        'phone' => '9876543299',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_rental_delivery' => true,
    ]);

    $this->vehicle = Vehicle::create([
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver->id,
        'registration_number' => 'KA01RENT99',
        'make' => 'Toyota',
        'model' => 'Fortuner',
        'year' => 2024,
        'color' => 'Black',
        'fuel_type' => 'diesel',
        'seats' => 7,
        'is_ac' => true,
        'is_active' => true,
        'approval_status' => 'approved',
        'condition' => 'good',
        'is_available_for_rent' => true,
    ]);

    Sanctum::actingAs($this->customer);
});

function mockRentalRazorpay(): \Mockery\MockInterface
{
    $mock = Mockery::mock(RazorpayService::class);
    app()->instance(RazorpayService::class, $mock);

    return $mock;
}

it('issues a rental quote with pricing snapshot and component breakdown (G-39)', function () {
    $payload = [
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(4)->toDateString(), // 3 days
        'pickup_location' => 'Indiranagar, Bangalore',
        'distance_km' => 350, // 300 included (100 * 3), 50 extra * 15 = 750
        'payment_method' => 'cash',
    ];

    $response = $this->postJson('/api/customer-app/rentals/quote', $payload)
        ->assertOk()
        ->assertJsonStructure([
            'success',
            'data' => [
                'quote_id',
                'quote_token',
                'expires_at',
                'subtotal',
                'base_price',
                'distance_price',
                'tax',
                'service_fee',
                'deposit',
                'total',
                'pricing_components' => [
                    'base_price_per_day',
                    'included_km_per_day',
                    'extra_km_charge',
                    'number_of_days',
                    'distance_km',
                    'included_km',
                    'extra_km',
                    'base_price',
                    'distance_price',
                    'subtotal',
                    'total_price',
                ],
            ],
        ]);

    $data = $response->json('data');
    expect($data['base_price'])->toEqual(9000); // 3000 * 3
    expect($data['distance_price'])->toEqual(750); // 50 * 15
    expect($data['subtotal'])->toEqual(9750);
    expect($data['pricing_snapshot']['number_of_days'])->toBe(3);
});

it('requires a verified quote token under contract v2 (G-39)', function () {
    $payload = [
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(3)->toDateString(),
        'pickup_location' => 'Koramangala, Bangalore',
        'payment_method' => 'cash',
    ];

    // V2 without quote token must fail
    $this->postJson('/api/customer-app/car-rentals', $payload, ['X-Booking-Contract' => '2'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('quote_token');

    // Legacy client without quote token succeeds
    $this->postJson('/api/customer-app/car-rentals', $payload)
        ->assertCreated()
        ->assertJsonPath('data.pricing_snapshot.number_of_days', 2);
});

it('honors a valid quote snapshot even if category catalog price increases before booking (G-39)', function () {
    $payload = [
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(3)->toDateString(), // 2 days: base = 6000
        'pickup_location' => 'Whitefield, Bangalore',
        'payment_method' => 'cash',
    ];

    $quote = $this->postJson('/api/customer-app/rentals/quote', $payload)->assertOk()->json('data');
    $quotedTotal = $quote['total'];
    $quotedBase = $quote['base_price'];

    // Admin updates the catalog price dramatically before booking arrives
    $this->category->update(['base_price_per_day' => 8000]); // would now be 16000

    // Booking with the valid quote token honors the locked quote
    $res = $this->postJson('/api/customer-app/car-rentals', [
        ...$payload,
        'quote_token' => $quote['quote_token'],
    ], ['X-Booking-Contract' => '2'])
        ->assertCreated();

    $rental = CarRental::findOrFail($res->json('data.id'));
    expect((float) $rental->base_price)->toBe((float) $quotedBase);
    expect((float) $rental->total_price)->toBe((float) $quotedTotal);
    expect($rental->pricing_snapshot['base_price_per_day'])->toEqual(3000);

    // Audit log confirms quote locking
    expect($rental->auditLogs()->where('action', 'pricing.snapshotted')->exists())->toBeTrue();
    $audit = $rental->auditLogs()->where('action', 'pricing.snapshotted')->first();
    expect($audit->note)->toContain('Rental pricing snapshot locked from quote');
});

it('rejects tampered or expired rental quotes (G-39)', function () {
    $payload = [
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(3)->toDateString(),
        'pickup_location' => 'MG Road, Bangalore',
        'payment_method' => 'cash',
    ];

    $quote = $this->postJson('/api/customer-app/rentals/quote', $payload)->assertOk()->json('data');

    // Tampering with payload: changing end_date
    $this->postJson('/api/customer-app/car-rentals', [
        ...$payload,
        'end_date' => today()->addDays(5)->toDateString(),
        'quote_token' => $quote['quote_token'],
    ])->assertUnprocessable()->assertJsonValidationErrors('quote_token');

    // Quote expired after 11 minutes
    $this->travel(11)->minutes();
    $this->postJson('/api/customer-app/car-rentals', [
        ...$payload,
        'quote_token' => $quote['quote_token'],
    ])->assertUnprocessable()->assertJsonValidationErrors('quote_token');
});

it('creates a provider payment order and returns checkout data for card and upi bookings (G-38)', function (string $method) {
    $payload = [
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(3)->toDateString(),
        'pickup_location' => 'Indiranagar, Bangalore',
        'payment_method' => $method,
    ];

    $gateway = mockRentalRazorpay();
    $gateway->shouldReceive('createOrder')
        ->once()
        ->with(Mockery::type('float'), Mockery::type('string'), Mockery::type('array'))
        ->andReturn([
            'id' => 'order_rentalcheckout123',
            'amount' => 600000,
            'currency' => 'INR',
        ]);

    $res = $this->postJson('/api/customer-app/car-rentals', $payload)
        ->assertCreated()
        ->assertJsonStructure([
            'success',
            'message',
            'data',
            'receipt',
            'checkout' => [
                'order_id',
                'amount_minor',
                'currency',
                'key',
            ],
        ]);

    expect($res->json('checkout.order_id'))->toBe('order_rentalcheckout123');
    expect($res->json('checkout.key'))->toBe('rzp_test_key_123');

    $rental = CarRental::findOrFail($res->json('data.id'));
    expect($rental->payment_status)->toBe('pending');
    expect($rental->status)->toBe('driver_assigned'); // matched vehicle assigned

    // PaymentOrder exists and is linked
    $order = $rental->paymentOrders()->first();
    expect($order)->not->toBeNull();
    expect($order->provider_order_id)->toBe('order_rentalcheckout123');
    expect($order->status)->toBe(PaymentOrder::STATUS_CREATED);
})->with(['card', 'upi', 'razorpay']);

it('rejects online payment methods when checkout is disabled (G-38)', function () {
    config(['services.razorpay.booking_checkout_enabled' => false]);
    mockRentalRazorpay()->shouldNotReceive('createOrder');

    $payload = [
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(3)->toDateString(),
        'pickup_location' => 'Indiranagar, Bangalore',
        'payment_method' => 'card',
    ];

    $this->postJson('/api/customer-app/car-rentals', $payload)
        ->assertStatus(503)
        ->assertJsonPath('message', 'Online booking checkout is not enabled.');

    expect(CarRental::count())->toBe(0);
});

it('completes rental payment transition upon capture verification (G-38)', function () {
    $payload = [
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(3)->toDateString(),
        'pickup_location' => 'Indiranagar, Bangalore',
        'payment_method' => 'card',
    ];

    $gateway = mockRentalRazorpay();
    $gateway->shouldReceive('createOrder')
        ->once()
        ->andReturn([
            'id' => 'order_rentalcapture999',
            'amount' => 600000,
            'currency' => 'INR',
        ]);

    $res = $this->postJson('/api/customer-app/car-rentals', $payload)->assertCreated();
    $rentalId = $res->json('data.id');
    $rental = CarRental::findOrFail($rentalId);
    $order = $rental->paymentOrders()->first();

    // Now customer completes checkout and client verifies with Razorpay signature
    $verifyPayload = [
        'razorpay_order_id' => 'order_rentalcapture999',
        'razorpay_payment_id' => 'pay_rentalcapture999',
        'razorpay_signature' => str_repeat('b', 64),
    ];

    $gateway->shouldReceive('verifySignature')
        ->once()
        ->with('order_rentalcapture999', 'pay_rentalcapture999', str_repeat('b', 64))
        ->andReturn(true);

    $gateway->shouldReceive('fetchPayment')
        ->once()
        ->with('pay_rentalcapture999')
        ->andReturn([
            'id' => 'pay_rentalcapture999',
            'order_id' => 'order_rentalcapture999',
            'amount' => $order->amount_minor,
            'currency' => 'INR',
            'status' => 'captured',
            'method' => 'card',
        ]);

    $this->postJson("/api/customer-app/booking-payments/rental/{$rentalId}/verify", $verifyPayload)
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid')
        ->assertJsonPath('data.checkout_state', 'paid');

    $rental->refresh();
    expect($rental->payment_status)->toBe('paid');
    expect($rental->status)->toBe('driver_assigned');
    expect($order->fresh()->status)->toBe(PaymentOrder::STATUS_PAID);

    // Lifecycle notification emitted
    Event::assertDispatched(BookingLifecycleNotification::class, function ($event) use ($rental) {
        return $event->action === 'payment.paid' && (int) $event->bookingId === (int) $rental->id;
    });
});

it('issues a quote and books a single day rental with 1 day price when start and end date match', function () {
    $date = today()->addDays(2)->toDateString();
    $payload = [
        'car_category_id' => $this->category->id,
        'start_date' => $date,
        'end_date' => $date,
        'pickup_location' => 'Indiranagar, Bangalore',
        'payment_method' => 'cash',
    ];

    $response = $this->postJson('/api/customer-app/rentals/quote', $payload)
        ->assertOk()
        ->assertJsonPath('data.pricing_components.number_of_days', 1)
        ->assertJsonPath('data.base_price', 3000);

    $quote = $response->json('data');

    $bookingResponse = $this->postJson('/api/customer-app/car-rentals', array_merge($payload, [
        'quote_token' => $quote['quote_token'],
    ]))->assertCreated();

    expect($bookingResponse->json('data.pricing_snapshot.number_of_days'))->toBe(1);
    expect((float) $bookingResponse->json('data.base_price'))->toBe(3000.0);
});

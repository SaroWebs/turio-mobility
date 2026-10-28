<?php

use App\Models\Customer;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourSchedule;
use App\Services\BookingCancellationService;
use App\Services\PaymentService;
use App\Services\RazorpayService;
use App\Support\Money;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Event::fake([\App\Events\BookingLifecycleNotification::class]);
    config(['tour_deposits.enabled' => true, 'tour_deposits.minimum_type' => 'fixed',
        'tour_deposits.minimum_value' => 25000, 'tour_deposits.policy_version' => 'test-v1',
        'services.razorpay.booking_checkout_enabled' => true, 'services.razorpay.key' => 'test-key', 'services.razorpay.secret' => 'test-secret']);
    $this->customer = Customer::create(['name' => 'Deposit Customer', 'phone' => '919000099001']);
    $this->tour = Tour::create(['title' => 'Deposit tour', 'slug' => 'deposit-tour', 'duration_days' => 1,
        'duration_nights' => 0, 'price_per_person' => 1000, 'child_price' => 500, 'is_active' => true]);
    $this->schedule = TourSchedule::create(['tour_id' => $this->tour->id, 'departure_date' => now()->addWeek()->toDateString(),
        'return_date' => now()->addWeek()->toDateString(), 'departure_time' => '09:00', 'total_seats' => 10,
        'reserved_seats' => 0, 'booked_seats' => 0, 'status' => 'open']);
    $this->payload = ['tour_id' => $this->tour->id, 'tour_schedule_id' => $this->schedule->id,
        'number_of_adults' => 1, 'number_of_children' => 0, 'payment_method' => 'cash', 'upfront_choice' => 'minimum'];
    $this->gateway = Mockery::mock(RazorpayService::class);
    app()->instance(RazorpayService::class, $this->gateway);
    Sanctum::actingAs($this->customer);
});

function depositBooking($test, array $changes = []): TourBooking
{
    $payload = [...$test->payload, ...$changes];
    $quote = $test->postJson('/api/customer-app/tours/quote', $payload)->assertOk()->json('data');
    $test->gateway->shouldReceive('createOrder')->once()->andReturnUsing(fn ($amount) => ['id' => 'order_deposit1', 'amount' => Money::toMinor($amount), 'currency' => 'INR']);
    $response = $test->postJson('/api/customer-app/tours/book', [...$payload, 'quote_token' => $quote['quote_token']])->assertCreated();

    return TourBooking::findOrFail($response->json('data.id'));
}

function depositCapture(TourBooking $booking, string $id = 'pay_deposit1', ?int $amount = null): array
{
    return ['order' => $booking->paymentOrders()->firstOrFail(), 'payable' => $booking, 'owner' => $booking->customer,
        'provider_payment_id' => $id, 'amount_minor' => $amount ?? $booking->payment_plan['selected_minor'], 'method' => 'upi'];
}

it('confirms a minimum deposit once without calling a partial booking fully paid', function () {
    $booking = depositBooking($this);
    expect($booking->paymentOrders()->first()->amount_minor)->toBe(25000);
    expect($booking->status)->toBe('pending');
    $this->getJson('/api/customer-app/booking-payments/tour/'.$booking->id)->assertOk()
        ->assertJsonPath('data.tour_payment.online_due_minor', 25000)
        ->assertJsonPath('data.tour_payment.remaining_cash_minor', $booking->payment_plan['total_minor'] - 25000);
    app(PaymentService::class)->recordCapturedPayment(depositCapture($booking));
    app(PaymentService::class)->recordCapturedPayment(depositCapture($booking));
    expect($booking->fresh()->status)->toBe('confirmed')->and($booking->fresh()->payment_status)->toBe('partial');
    expect($booking->fresh()->payment_method)->toBe('cash')->and($booking->fresh()->online_paid_minor)->toBe(25000);
    expect($this->schedule->fresh()->booked_seats)->toBe(1)->and($this->schedule->fresh()->reserved_seats)->toBe(0);
    expect($booking->payments()->count())->toBe(1);
    $this->getJson('/api/customer-app/booking-payments/tour/'.$booking->id)->assertOk()
        ->assertJsonPath('data.checkout_state', 'deposit_paid')->assertJsonPath('data.can_pay', false)
        ->assertJsonPath('data.tour_payment.remaining_cash_minor', $booking->payment_plan['total_minor'] - 25000);
});

it('supports full and custom online amounts', function ($choice, $selected) {
    $booking = depositBooking($this, ['upfront_choice' => $choice, ...($choice === 'custom' ? ['upfront_amount_minor' => $selected] : [])]);
    app(PaymentService::class)->recordCapturedPayment(depositCapture($booking));
    expect($booking->fresh()->payment_status)->toBe($choice === 'full' ? 'paid' : 'partial');
    $this->getJson('/api/customer-app/booking-payments/tour/'.$booking->id)->assertOk()
        ->assertJsonPath('data.tour_payment.remaining_cash_minor', $choice === 'full' ? 0 : $booking->payment_plan['total_minor'] - $selected);
})->with([['full', 0], ['custom', 50000]]);

it('rejects invalid custom amounts before reserving seats', function ($amount) {
    $this->postJson('/api/customer-app/tours/quote', [...$this->payload, 'upfront_choice' => 'custom', 'upfront_amount_minor' => $amount])->assertUnprocessable();
    expect(TourBooking::count())->toBe(0)->and($this->schedule->fresh()->reserved_seats)->toBe(0);
})->with([24999, 999999999, 25000.5, null, -1]);

it('requires a configured policy and working checkout gate', function () {
    config(['tour_deposits.minimum_value' => null]);
    $this->postJson('/api/customer-app/tours/quote', $this->payload)->assertStatus(503);
    config(['tour_deposits.minimum_value' => 25000, 'services.razorpay.booking_checkout_enabled' => false]);
    $this->postJson('/api/customer-app/tours/book', $this->payload)->assertStatus(503);
    expect(TourBooking::count())->toBe(0);
});

it('rounds a percentage minimum up to the next paise', function () {
    config(['tour_deposits.minimum_type' => 'percentage', 'tour_deposits.minimum_value' => 3333]);
    $quote = $this->postJson('/api/customer-app/tours/quote', $this->payload)->assertOk()->json('data');
    expect($quote['payment_plan']['minimum_minor'])->toBe(intdiv($quote['amount_minor'] * 3333 + 9999, 10000));
});

it('rejects a missing quote or policy change after quote without creating a booking', function () {
    $this->postJson('/api/customer-app/tours/book', $this->payload)->assertUnprocessable();
    $quote = $this->postJson('/api/customer-app/tours/quote', $this->payload)->assertOk()->json('data');
    config(['tour_deposits.minimum_value' => 30000]);
    $this->postJson('/api/customer-app/tours/book', [...$this->payload, 'quote_token' => $quote['quote_token']])->assertUnprocessable();
    expect(TourBooking::count())->toBe(0);
});

it('blocks wallet and manual confirmation bypasses', function () {
    $quote = $this->postJson('/api/customer-app/tours/quote', $this->payload)->assertOk()->json('data');
    $this->postJson('/api/customer-app/tours/book', [...$this->payload, 'payment_method' => 'wallet', 'quote_token' => $quote['quote_token']])->assertUnprocessable();
    $booking = depositBooking($this);
    expect(fn () => app(PaymentService::class)->confirmTourBooking($booking))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    expect(fn () => app(PaymentService::class)->recordAdminReceipt($booking, 'cash', 'manual', 1))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    expect(fn () => $booking->update(['status' => 'confirmed']))->toThrow(\Illuminate\Validation\ValidationException::class);
    expect($booking->fresh()->status)->toBe('pending');
});

it('turns late or mismatched deposits into a refund liability without confirming seats', function ($late) {
    $booking = depositBooking($this);
    if ($late) {
        $booking->update(['hold_expires_at' => now()]);
    }
    $capture = depositCapture($booking, 'pay_invalid1', $late ? 25000 : 25001);
    app(PaymentService::class)->recordCapturedPayment($capture);
    app(PaymentService::class)->recordCapturedPayment($capture);
    expect($booking->fresh()->status)->not->toBe('confirmed');
    expect($booking->refunds()->count())->toBe(1)->and($this->schedule->fresh()->booked_seats)->toBe(0);
    expect($booking->fresh()->online_paid_minor)->toBe(0);
})->with([true, false]);

it('limits cancellation refund to the deposit actually collected and releases booked seats once', function () {
    $booking = depositBooking($this);
    app(PaymentService::class)->recordCapturedPayment(depositCapture($booking));
    $refund = app(BookingCancellationService::class)->cancel($booking, 'tour', 'Cancelled by operations', null, 'system');
    app(BookingCancellationService::class)->cancel($booking, 'tour', 'Retry', null, 'system');
    expect((float) $refund->amount)->toBe(250.0)->and($refund->status)->toBe('pending')->and($refund->method)->toBe('online');
    expect($booking->refunds()->count())->toBe(1)->and($this->schedule->fresh()->booked_seats)->toBe(0);
});

it('preserves the reservation and uncertain provider intent after order creation timeout', function () {
    $quote = $this->postJson('/api/customer-app/tours/quote', $this->payload)->assertOk()->json('data');
    $this->gateway->shouldReceive('createOrder')->once()->andThrow(new RuntimeException('timeout'));
    $response = $this->postJson('/api/customer-app/tours/book', [...$this->payload, 'quote_token' => $quote['quote_token']])->assertCreated();
    expect($response->json('checkout_message'))->toContain('do not create another booking');
    $booking = TourBooking::findOrFail($response->json('data.id'));
    $this->postJson('/api/customer-app/booking-payments/tour/'.$booking->id.'/order')->assertStatus(409);
    expect($booking->paymentOrders()->count())->toBe(1);
});

it('verifies the selected provider deposit through the customer checkout API', function () {
    $booking = depositBooking($this);
    $this->gateway->shouldReceive('verifySignature')->once()->andReturn(true);
    $this->gateway->shouldReceive('fetchPayment')->once()->andReturn(['id' => 'pay_verified1', 'order_id' => 'order_deposit1',
        'amount' => 25000, 'currency' => 'INR', 'status' => 'captured', 'method' => 'upi']);
    config(['tour_deposits.minimum_value' => 90000, 'tour_deposits.policy_version' => 'changed-after-booking']);
    $this->postJson('/api/customer-app/booking-payments/tour/'.$booking->id.'/verify', [
        'razorpay_order_id' => 'order_deposit1', 'razorpay_payment_id' => 'pay_verified1', 'razorpay_signature' => str_repeat('a', 64),
    ])->assertOk()->assertJsonPath('data.checkout_state', 'deposit_paid')->assertJsonPath('data.tour_payment.online_paid_minor', 25000);
    expect($booking->fresh()->payment_plan['policy_version'])->toBe('test-v1');
    $this->travel(31)->minutes();
    $this->artisan('tours:expire-holds')->assertSuccessful();
    expect($booking->fresh()->status)->toBe('confirmed');
});

it('keeps additional captures as liabilities without double seat allocation or cash reduction', function () {
    $booking = depositBooking($this);
    app(PaymentService::class)->recordCapturedPayment(depositCapture($booking));
    $extra = depositCapture($booking, 'pay_extra1');
    app(PaymentService::class)->recordCapturedPayment($extra);
    app(PaymentService::class)->recordCapturedPayment($extra);
    expect($booking->fresh()->online_paid_minor)->toBe(25000)->and($booking->refunds()->count())->toBe(1);
    expect($this->schedule->fresh()->booked_seats)->toBe(1);
    $this->getJson('/api/customer-app/booking-payments/tour/'.$booking->id)->assertOk()
        ->assertJsonPath('data.checkout_state', 'refund_pending')->assertJsonPath('data.tour_payment.online_paid_minor', 50000)
        ->assertJsonPath('data.tour_payment.refund_pending_minor', 25000);
    app(BookingCancellationService::class)->processRefund($booking->refunds()->first());
    expect($booking->fresh()->status)->toBe('confirmed')->and($booking->fresh()->payment_status)->toBe('partial');
    expect($booking->fresh()->online_paid_minor)->toBe(25000);
});

it('rejects payment plan edits and falsely marking a partial deposit paid', function () {
    $booking = depositBooking($this);
    app(PaymentService::class)->recordCapturedPayment(depositCapture($booking));
    expect(fn () => $booking->fresh()->update(['payment_plan' => null]))->toThrow(\Illuminate\Validation\ValidationException::class);
    expect(fn () => $booking->fresh()->update(['total_price' => 1]))->toThrow(\Illuminate\Validation\ValidationException::class);
    expect(fn () => $booking->fresh()->update(['payment_status' => 'paid']))->toThrow(\Illuminate\Validation\ValidationException::class);
});

it('does not apply legacy tour settlement to a full online deposit booking', function () {
    $booking = depositBooking($this, ['upfront_choice' => 'full']);
    app(PaymentService::class)->recordCapturedPayment(depositCapture($booking));
    $driver = \App\Models\Driver::create(['name' => 'Deposit Driver', 'phone' => '919000099002', 'is_active' => true]);
    $booking->refresh()->update(['status' => 'completed', 'assigned_driver_id' => $driver->id]);
    expect(app(\App\Services\CommissionService::class)->settleTour($booking->fresh()))->toBeFalse();
    expect((float) $booking->fresh()->driver_share)->toBe(0.0);
});

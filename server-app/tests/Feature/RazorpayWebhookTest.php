<?php

use App\Models\Customer;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\RazorpayWebhookEvent;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourSchedule;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Services\PaymentService;

/** POST a signed Razorpay webhook payload. */
function postRazorpayWebhook(array $body, ?string $eventId = null): \Illuminate\Testing\TestResponse
{
    $payload = json_encode($body);
    $signature = hash_hmac('sha256', $payload, 'webhook-secret');

    $server = [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_RAZORPAY_SIGNATURE' => $signature,
    ];
    if ($eventId !== null) {
        $server['HTTP_X_RAZORPAY_EVENT_ID'] = $eventId;
    }

    return test()->call('POST', '/api/razorpay/webhook', [], [], [], $server, $payload);
}

function capturedPaymentPayload(array $entity): array
{
    return [
        'event' => 'payment.captured',
        'payload' => ['payment' => ['entity' => $entity]],
    ];
}

beforeEach(function () {
    config(['services.razorpay.webhook_secret' => 'webhook-secret']);
});

it('accepts razorpay webhooks with a valid signature', function () {
    postRazorpayWebhook(capturedPaymentPayload(['id' => 'pay_webhook_123', 'status' => 'captured']))
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('event', 'payment.captured');
});

it('rejects razorpay webhooks with an invalid signature', function () {
    $payload = json_encode(['event' => 'payment.captured']);

    $this->call('POST', '/api/razorpay/webhook', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_RAZORPAY_SIGNATURE' => 'bad-signature',
    ], $payload)
        ->assertStatus(400)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Invalid webhook signature');
});

it('stores the raw event and credits the wallet on a captured top-up', function () {
    $customer = Customer::create(['name' => 'WH Topup', 'phone' => '9500000001']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 0,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    postRazorpayWebhook(capturedPaymentPayload([
        'id' => 'pay_topup_1',
        'order_id' => 'order_topup_1',
        'amount' => 50000, // ₹500 in paise
        'method' => 'upi',
        'notes' => ['purpose' => 'wallet_topup', 'wallet_id' => $wallet->id],
    ]))->assertOk();

    expect((int) $wallet->fresh()->balance_minor)->toBe(50000);

    $event = RazorpayWebhookEvent::where('event_type', 'payment.captured')->firstOrFail();
    expect($event->status)->toBe(RazorpayWebhookEvent::STATUS_PROCESSED);
});

it('does not double-credit the wallet when the same payment is redelivered', function () {
    $customer = Customer::create(['name' => 'WH Dedup', 'phone' => '9500000002']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 0,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $payload = capturedPaymentPayload([
        'id' => 'pay_topup_dup',
        'order_id' => 'order_topup_dup',
        'amount' => 30000,
        'method' => 'upi',
        'notes' => ['purpose' => 'wallet_topup', 'wallet_id' => $wallet->id],
    ]);

    // Same delivery id → deduped at the raw-event layer (no reprocessing).
    postRazorpayWebhook($payload, 'evt_dup_1')->assertOk();
    postRazorpayWebhook($payload, 'evt_dup_1')->assertOk();

    // Different delivery id, same payment id → reprocessed, but the wallet
    // credit is idempotent on the provider payment id.
    postRazorpayWebhook($payload, 'evt_dup_2')->assertOk();

    expect((int) $wallet->fresh()->balance_minor)->toBe(30000)
        ->and(RazorpayWebhookEvent::count())->toBe(2);
});

it('captures a booking payment against a matching order on webhook', function () {
    $customer = Customer::create(['name' => 'WH Booking', 'phone' => '9500000003']);
    $tour = Tour::create([
        'title' => 'WH Tour', 'slug' => 'wh-tour-'.uniqid(),
        'duration_days' => 1, 'duration_nights' => 0,
        'price_per_person' => 1000, 'child_price' => 500,
        'available_from' => now(), 'available_to' => now()->addMonth(), 'is_active' => true,
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addWeek()->toDateString(),
        'return_date' => now()->addWeek()->toDateString(),
        'total_seats' => 10, 'reserved_seats' => 0, 'booked_seats' => 0, 'status' => 'open',
    ]);
    $booking = TourBooking::create([
        'customer_id' => $customer->id, 'tour_id' => $tour->id, 'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 2, 'number_of_children' => 0, 'travel_date' => $schedule->departure_date,
        'customer_name' => $customer->name, 'customer_phone' => $customer->phone,
        'price_per_adult' => 1000, 'price_per_child' => 500, 'subtotal' => 2000, 'total_price' => 2000,
        'status' => 'pending', 'payment_status' => 'pending', 'payment_method' => 'cash',
    ]);

    $order = app(PaymentService::class)->createOrder(200000, $booking, $customer, [
        'provider_order_id' => 'order_book_1',
    ]);

    postRazorpayWebhook(capturedPaymentPayload([
        'id' => 'pay_book_1',
        'order_id' => 'order_book_1',
        'amount' => 200000,
        'method' => 'card',
    ]))->assertOk();

    expect($booking->fresh()->payment_status)->toBe('paid')
        ->and($order->fresh()->isPaid())->toBeTrue()
        ->and(Payment::where('provider_payment_id', 'pay_book_1')->firstOrFail()->isCaptured())->toBeTrue()
        ->and((int) LedgerEntry::where('direction', 'debit')->sum('amount_minor'))
        ->toBe((int) LedgerEntry::where('direction', 'credit')->sum('amount_minor'));
});

it('marks a payment failed on a payment.failed webhook', function () {
    $order = app(PaymentService::class)->createOrder(50000, null, null, [
        'provider_order_id' => 'order_fail_1',
    ]);

    postRazorpayWebhook([
        'event' => 'payment.failed',
        'payload' => ['payment' => ['entity' => [
            'id' => 'pay_fail_1',
            'order_id' => 'order_fail_1',
            'amount' => 50000,
            'error_code' => 'BANK_DECLINED',
            'error_description' => 'insufficient funds',
        ]]],
    ])->assertOk();

    expect(Payment::where('provider_payment_id', 'pay_fail_1')->firstOrFail()->status)
        ->toBe(Payment::STATUS_FAILED)
        ->and($order->fresh()->status)->toBe(\App\Models\PaymentOrder::STATUS_FAILED);
});

it('ignores recognised but unhandled event types without failing', function () {
    postRazorpayWebhook([
        'event' => 'subscription.charged',
        'payload' => ['subscription' => ['entity' => ['id' => 'sub_1']]],
    ])->assertOk();

    $event = RazorpayWebhookEvent::where('event_type', 'subscription.charged')->firstOrFail();
    expect($event->status)->toBe(RazorpayWebhookEvent::STATUS_IGNORED);
});

it('applies a refund to a captured payment and posts to the refunds ledger', function () {
    $order = app(PaymentService::class)->createOrder(200000, null, null, [
        'provider_order_id' => 'order_refund_1',
    ]);
    app(PaymentService::class)->recordCapturedPayment([
        'order' => $order,
        'provider' => 'razorpay',
        'provider_payment_id' => 'pay_refund_1',
        'provider_order_id' => 'order_refund_1',
        'amount_minor' => 200000,
        'currency' => 'INR',
        'method' => 'card',
    ]);

    postRazorpayWebhook([
        'event' => 'refund.processed',
        'payload' => ['refund' => ['entity' => [
            'id' => 'rfnd_1',
            'payment_id' => 'pay_refund_1',
            'amount' => 50000, // partial ₹500 of ₹2000
        ]]],
    ])->assertOk();

    $payment = Payment::where('provider_payment_id', 'pay_refund_1')->firstOrFail();

    expect((int) $payment->amount_refunded_minor)->toBe(50000)
        ->and($payment->status)->toBe(Payment::STATUS_PARTIALLY_REFUNDED)
        // the refund's debit leg lands in system:refunds
        ->and((int) LedgerEntry::where('reference_type', 'razorpay_refund')
            ->where('direction', 'debit')->sum('amount_minor'))->toBe(50000)
        // ledger stays balanced overall
        ->and((int) LedgerEntry::where('direction', 'debit')->sum('amount_minor'))
        ->toBe((int) LedgerEntry::where('direction', 'credit')->sum('amount_minor'));
});

it('does not double-apply a redelivered refund', function () {
    $order = app(PaymentService::class)->createOrder(200000, null, null, [
        'provider_order_id' => 'order_refund_dup',
    ]);
    app(PaymentService::class)->recordCapturedPayment([
        'order' => $order,
        'provider' => 'razorpay',
        'provider_payment_id' => 'pay_refund_dup',
        'provider_order_id' => 'order_refund_dup',
        'amount_minor' => 200000,
        'currency' => 'INR',
    ]);

    $refundPayload = [
        'event' => 'refund.processed',
        'payload' => ['refund' => ['entity' => [
            'id' => 'rfnd_dup',
            'payment_id' => 'pay_refund_dup',
            'amount' => 50000,
        ]]],
    ];

    // Different delivery ids for the same refund → reprocessed at the raw layer,
    // but the ledger guard keeps the money effect applied exactly once.
    postRazorpayWebhook($refundPayload, 'evt_rfnd_1')->assertOk();
    postRazorpayWebhook($refundPayload, 'evt_rfnd_2')->assertOk();

    $payment = Payment::where('provider_payment_id', 'pay_refund_dup')->firstOrFail();

    expect((int) $payment->amount_refunded_minor)->toBe(50000)
        ->and(LedgerEntry::where('reference_type', 'razorpay_refund')
            ->where('reference_id', 'rfnd_dup')->count())->toBe(2) // one balanced pair only
        ->and(RazorpayWebhookEvent::count())->toBe(2);
});

it('marks a payout processed and completes the withdrawal on a payout.processed webhook', function () {
    $customer = Customer::create(['name' => 'PO Driver', 'phone' => '9500000010']);
    $withdrawal = WithdrawalRequest::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'amount' => 1000,
        'method' => 'bank_transfer',
        'account_details' => ['account_number' => '000111', 'ifsc' => 'HDFC0001'],
        'status' => 'processing',
    ]);
    $payout = app(PaymentService::class)->createPayout($withdrawal, 100000);
    // Provider payout id is assigned when the payout is initiated at Razorpay.
    $payout->markQueued('pout_1');

    postRazorpayWebhook([
        'event' => 'payout.processed',
        'payload' => ['payout' => ['entity' => ['id' => 'pout_1', 'utr' => 'UTR123', 'status' => 'processed']]],
    ])->assertOk();

    expect($payout->fresh()->isProcessed())->toBeTrue()
        ->and($payout->fresh()->utr)->toBe('UTR123')
        ->and($withdrawal->fresh()->status)->toBe('completed')
        ->and((int) LedgerEntry::where('reference_type', 'payout')
            ->where('direction', 'debit')->sum('amount_minor'))->toBe(100000)
        ->and((int) LedgerEntry::where('direction', 'debit')->sum('amount_minor'))
        ->toBe((int) LedgerEntry::where('direction', 'credit')->sum('amount_minor'));
});

it('marks a payout failed on a payout.failed webhook', function () {
    $customer = Customer::create(['name' => 'PO Fail', 'phone' => '9500000011']);
    $withdrawal = WithdrawalRequest::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'amount' => 500,
        'method' => 'bank_transfer',
        'account_details' => ['account_number' => '000222', 'ifsc' => 'HDFC0002'],
        'status' => 'processing',
    ]);
    $payout = app(PaymentService::class)->createPayout($withdrawal, 50000);
    $payout->markQueued('pout_fail_1');

    postRazorpayWebhook([
        'event' => 'payout.failed',
        'payload' => ['payout' => ['entity' => [
            'id' => 'pout_fail_1',
            'status' => 'failed',
            'status_details' => ['reason' => 'beneficiary_bank_offline', 'description' => 'Bank offline'],
        ]]],
    ])->assertOk();

    expect($payout->fresh()->status)->toBe(Payout::STATUS_FAILED)
        // a failed payout posts no settlement ledger entries
        ->and(LedgerEntry::where('reference_type', 'payout')->count())->toBe(0);
});

it('releases the held wallet balance when a payout fails', function () {
    $customer = Customer::create(['name' => 'PO Release', 'phone' => '9500000012']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 1000,
        'currency' => 'INR',
        'is_active' => true,
    ]);
    $withdrawal = WithdrawalRequest::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'amount' => 250,
        'method' => 'bank_transfer',
        'account_details' => ['account_number' => '000333', 'ifsc' => 'HDFC0003'],
        'status' => 'processing',
    ]);
    $wallet->debit(250, 'Withdrawal hold', 'driver_withdrawal', (string) $withdrawal->id, 'withdrawal_hold:'.$withdrawal->id);
    $payout = app(PaymentService::class)->createPayout($withdrawal, 25000);
    $payout->markQueued('pout_release_1');

    postRazorpayWebhook([
        'event' => 'payout.failed',
        'payload' => ['payout' => ['entity' => [
            'id' => 'pout_release_1',
            'status' => 'failed',
            'status_details' => ['description' => 'Beneficiary rejected'],
        ]]],
    ])->assertOk();

    expect((int) $wallet->fresh()->balance_minor)->toBe(100000)
        ->and($withdrawal->fresh()->status)->toBe('rejected')
        ->and(LedgerEntry::where('reference_type', 'driver_withdrawal')
            ->where('reference_id', (string) $withdrawal->id)
            ->count())->toBe(4);
});

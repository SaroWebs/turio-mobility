<?php

use App\Models\Customer;
use App\Models\LedgerAccount;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\PaymentOrder;
use App\Models\Payout;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourSchedule;
use App\Models\WithdrawalRequest;
use App\Services\PaymentService;

/** Minimal paid-able tour booking for payment-mirror assertions. */
function paymentDomainTourBooking(string $paymentStatus = 'pending'): TourBooking
{
    $customer = Customer::create(['name' => 'PD Customer', 'phone' => '93'.random_int(10000000, 99999999)]);
    $tour = Tour::create([
        'title' => 'PD Tour',
        'slug' => 'pd-tour-'.uniqid(),
        'duration_days' => 1,
        'duration_nights' => 0,
        'price_per_person' => 1000,
        'child_price' => 500,
        'available_from' => now(),
        'available_to' => now()->addMonth(),
        'is_active' => true,
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addWeek()->toDateString(),
        'return_date' => now()->addWeek()->toDateString(),
        'total_seats' => 10,
        'reserved_seats' => 0,
        'booked_seats' => 0,
        'status' => 'open',
    ]);

    return TourBooking::create([
        'customer_id' => $customer->id,
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 2,
        'number_of_children' => 0,
        'travel_date' => $schedule->departure_date,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'price_per_adult' => 1000,
        'price_per_child' => 500,
        'subtotal' => 2000,
        'total_price' => 2000,
        'status' => 'pending',
        'payment_status' => $paymentStatus,
        'payment_method' => 'cash',
    ]);
}

it('walks an order from created through captured payment', function () {
    $service = app(PaymentService::class);

    $order = $service->createOrder(50000, null, null, ['provider_order_id' => 'order_pd_1']);
    expect($order->status)->toBe(PaymentOrder::STATUS_CREATED);

    $payment = $service->recordCapturedPayment([
        'order' => $order,
        'provider_payment_id' => 'pay_pd_1',
        'provider_order_id' => 'order_pd_1',
        'amount_minor' => 50000,
        'method' => 'upi',
    ]);

    expect($payment->isCaptured())->toBeTrue()
        ->and($payment->captured_at)->not->toBeNull()
        ->and((int) $payment->amount_minor)->toBe(50000)
        ->and($order->fresh()->isPaid())->toBeTrue();
});

it('is idempotent on repeated capture of the same provider payment id', function () {
    $service = app(PaymentService::class);
    $booking = paymentDomainTourBooking();

    $service->recordCapturedPayment([
        'payable' => $booking,
        'provider_payment_id' => 'pay_pd_dup',
        'amount_minor' => 200000,
        'method' => 'card',
    ]);

    $ledgerAfterFirst = LedgerEntry::count();

    $service->recordCapturedPayment([
        'payable' => $booking,
        'provider_payment_id' => 'pay_pd_dup',
        'amount_minor' => 200000,
        'method' => 'card',
    ]);

    expect(Payment::where('provider_payment_id', 'pay_pd_dup')->count())->toBe(1)
        ->and(LedgerEntry::count())->toBe($ledgerAfterFirst)
        ->and($ledgerAfterFirst)->toBe(2);
});

it('mirrors the booking payment_status to paid on capture for legacy clients', function () {
    $service = app(PaymentService::class);
    $booking = paymentDomainTourBooking('pending');

    $service->recordCapturedPayment([
        'payable' => $booking,
        'provider_payment_id' => 'pay_pd_mirror',
        'amount_minor' => 200000,
        'method' => 'upi',
    ]);

    $fresh = $booking->fresh();
    expect($fresh->payment_status)->toBe('paid')
        ->and($fresh->payment_method)->toBe('upi');
});

it('posts a balanced gateway-clearing to booking-revenue pair on booking capture', function () {
    $service = app(PaymentService::class);
    $booking = paymentDomainTourBooking();

    $service->recordCapturedPayment([
        'payable' => $booking,
        'provider_payment_id' => 'pay_pd_ledger',
        'amount_minor' => 200000,
        'method' => 'card',
    ]);

    $gateway = LedgerAccount::where('code', 'system:gateway_clearing')->firstOrFail();
    $revenue = LedgerAccount::where('code', 'system:booking_revenue')->firstOrFail();

    $debit = LedgerEntry::where('ledger_account_id', $gateway->id)->firstOrFail();
    $credit = LedgerEntry::where('ledger_account_id', $revenue->id)->firstOrFail();

    expect($debit->direction)->toBe('debit')
        ->and($credit->direction)->toBe('credit')
        ->and((int) $debit->amount_minor)->toBe(200000)
        ->and((int) $credit->amount_minor)->toBe(200000)
        ->and($debit->transaction_ref)->toBe($credit->transaction_ref);

    // Whole ledger stays balanced.
    expect((int) LedgerEntry::where('direction', 'debit')->sum('amount_minor'))
        ->toBe((int) LedgerEntry::where('direction', 'credit')->sum('amount_minor'));
});

it('posts payout clearing to bank settlement and completes the withdrawal on payout processed', function () {
    $service = app(PaymentService::class);
    $customer = Customer::create(['name' => 'Payout Customer', 'phone' => '9400000001']);
    $withdrawal = WithdrawalRequest::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'amount' => 1500,
        'method' => 'bank_transfer',
        'account_details' => ['account_number' => 'XXXX'],
        'status' => 'processing',
    ]);

    $payout = $service->createPayout($withdrawal, 150000);
    expect($payout->status)->toBe(Payout::STATUS_CREATED);

    $service->markPayoutProcessed($payout, 'UTR12345');

    $clearing = LedgerAccount::where('code', 'system:payout_clearing')->firstOrFail();
    $settlement = LedgerAccount::where('code', 'system:bank_settlement')->firstOrFail();

    $debit = LedgerEntry::where('ledger_account_id', $clearing->id)->firstOrFail();
    $credit = LedgerEntry::where('ledger_account_id', $settlement->id)->firstOrFail();

    expect($payout->fresh()->isProcessed())->toBeTrue()
        ->and($debit->direction)->toBe('debit')
        ->and($credit->direction)->toBe('credit')
        ->and((int) $debit->amount_minor)->toBe(150000)
        ->and((int) $credit->amount_minor)->toBe(150000)
        ->and($debit->transaction_ref)->toBe($credit->transaction_ref)
        ->and($withdrawal->fresh()->status)->toBe('completed');
});

it('does not regress a captured payment when a late failure webhook arrives', function () {
    $service = app(PaymentService::class);

    $service->recordCapturedPayment([
        'provider_payment_id' => 'pay_pd_race',
        'amount_minor' => 50000,
        'method' => 'upi',
    ]);

    $service->markPaymentFailed([
        'provider_payment_id' => 'pay_pd_race',
        'error_code' => 'BANK_DECLINED',
        'error_description' => 'late failure',
    ]);

    expect(Payment::where('provider_payment_id', 'pay_pd_race')->firstOrFail()->isCaptured())->toBeTrue();
});

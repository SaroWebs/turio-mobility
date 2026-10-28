<?php

use App\Models\Customer;
use App\Models\LedgerAccount;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\ReconciliationMismatch;
use App\Models\RideBooking;
use App\Models\WithdrawalRequest;
use App\Services\LedgerService;
use App\Services\PaymentService;
use App\Services\ReconciliationService;
use Illuminate\Support\Facades\Http;

function recon(): ReconciliationService
{
    return app(ReconciliationService::class);
}

function reconRideBooking(): RideBooking
{
    $customer = Customer::create([
        'name' => 'Recon Rider',
        'phone' => '96'.random_int(10000000, 99999999),
    ]);

    return RideBooking::create([
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
        'total_fare' => 2500,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'upi',
    ]);
}

// The test environment has a Razorpay key configured, so the provider leg would
// make a live settlements call. Tests that exercise the internal books
// (ledger/payments/payouts) therefore pass checkProvider: false; the provider
// leg is covered explicitly by the two Http::fake tests at the bottom.

it('reports no mismatches when the ledger, payments and payouts all agree', function () {
    $booking = reconRideBooking();

    app(PaymentService::class)->recordCapturedPayment([
        'payable' => $booking,
        'provider_payment_id' => 'pay_recon_ok',
        'amount_minor' => 250000,
        'method' => 'upi',
    ]);

    $report = recon()->run(checkProvider: false);

    expect($report['mismatches'])->toBe(0)
        ->and($report['provider'])->toBe('skipped')
        ->and(ReconciliationMismatch::open()->count())->toBe(0);
});

it('flags a captured booking payment with no revenue posting', function () {
    $booking = reconRideBooking();

    // A captured payment recorded without its gateway → revenue ledger pair.
    Payment::create([
        'provider' => 'razorpay',
        'provider_payment_id' => 'pay_recon_missing',
        'payable_type' => RideBooking::class,
        'payable_id' => $booking->id,
        'amount_minor' => 250000,
        'currency' => 'INR',
        'status' => Payment::STATUS_CAPTURED,
        'captured_at' => now(),
    ]);

    recon()->run(checkProvider: false);

    $mismatch = ReconciliationMismatch::open()
        ->where('type', ReconciliationMismatch::TYPE_PAYMENT_MISSING_LEDGER)
        ->first();

    expect($mismatch)->not->toBeNull()
        ->and((int) $mismatch->expected_minor)->toBe(250000)
        ->and((int) $mismatch->actual_minor)->toBe(0)
        ->and($mismatch->reference_type)->toBe(RideBooking::class)
        ->and((string) $mismatch->reference_id)->toBe((string) $booking->id);
});

it('flags a globally unbalanced ledger', function () {
    $account = LedgerAccount::create([
        'code' => 'system:test_suspense',
        'name' => 'Test Suspense',
        'type' => 'system',
        'currency' => 'INR',
    ]);

    // A lone debit with no matching credit — the book no longer nets to zero.
    LedgerEntry::create([
        'transaction_ref' => 'tx-recon-broken',
        'ledger_account_id' => $account->id,
        'direction' => 'debit',
        'amount_minor' => 5000,
        'currency' => 'INR',
        'posted_at' => now(),
    ]);

    recon()->run(checkProvider: false);

    $global = ReconciliationMismatch::open()
        ->where('type', ReconciliationMismatch::TYPE_LEDGER_IMBALANCE)
        ->where('reference_id', 'global')
        ->first();

    expect($global)->not->toBeNull()
        ->and((int) $global->actual_minor)->toBe(5000)
        ->and((int) $global->expected_minor)->toBe(0);
});

it('auto-resolves a mismatch once the discrepancy clears', function () {
    $booking = reconRideBooking();

    Payment::create([
        'provider' => 'razorpay',
        'provider_payment_id' => 'pay_recon_fixlater',
        'payable_type' => RideBooking::class,
        'payable_id' => $booking->id,
        'amount_minor' => 250000,
        'currency' => 'INR',
        'status' => Payment::STATUS_CAPTURED,
        'captured_at' => now(),
    ]);

    recon()->run(checkProvider: false);
    expect(ReconciliationMismatch::open()
        ->where('type', ReconciliationMismatch::TYPE_PAYMENT_MISSING_LEDGER)
        ->count())->toBe(1);

    // Post the previously-missing revenue pair, then reconcile again.
    app(LedgerService::class)->post('system:gateway_clearing', 'system:booking_revenue', 250000, [
        'reference_type' => RideBooking::class,
        'reference_id' => (string) $booking->id,
    ]);

    recon()->run(checkProvider: false);

    $mismatch = ReconciliationMismatch::where('type', ReconciliationMismatch::TYPE_PAYMENT_MISSING_LEDGER)->first();

    expect(ReconciliationMismatch::open()->count())->toBe(0)
        ->and($mismatch->status)->toBe(ReconciliationMismatch::STATUS_RESOLVED)
        ->and($mismatch->resolved_at)->not->toBeNull();
});

it('does not duplicate an open mismatch across repeated runs', function () {
    $booking = reconRideBooking();

    Payment::create([
        'provider' => 'razorpay',
        'provider_payment_id' => 'pay_recon_dupe',
        'payable_type' => RideBooking::class,
        'payable_id' => $booking->id,
        'amount_minor' => 250000,
        'currency' => 'INR',
        'status' => Payment::STATUS_CAPTURED,
        'captured_at' => now(),
    ]);

    recon()->run(checkProvider: false);
    $detectedAt = ReconciliationMismatch::firstOrFail()->detected_at;

    recon()->run(checkProvider: false);

    expect(ReconciliationMismatch::where('type', ReconciliationMismatch::TYPE_PAYMENT_MISSING_LEDGER)->count())->toBe(1)
        ->and(ReconciliationMismatch::firstOrFail()->detected_at->timestamp)->toBe($detectedAt->timestamp);
});

it('flags a processed payout with no settlement posting', function () {
    $customer = Customer::create(['name' => 'Payout Owner', 'phone' => '97'.random_int(10000000, 99999999)]);
    $withdrawal = WithdrawalRequest::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'amount' => 1500,
        'method' => 'bank_transfer',
        'account_details' => ['account_number' => 'XXXX'],
        'status' => 'processing',
    ]);

    Payout::create([
        'payout_number' => 'PO_RECON_TEST',
        'provider' => 'razorpay',
        'withdrawal_request_id' => $withdrawal->id,
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'amount_minor' => 150000,
        'currency' => 'INR',
        'status' => Payout::STATUS_PROCESSED,
        'processed_at' => now(),
    ]);

    recon()->run(checkProvider: false);

    $mismatch = ReconciliationMismatch::open()
        ->where('type', ReconciliationMismatch::TYPE_PAYOUT_MISSING_LEDGER)
        ->first();

    expect($mismatch)->not->toBeNull()
        ->and((int) $mismatch->expected_minor)->toBe(150000)
        ->and((int) $mismatch->actual_minor)->toBe(0);
});

it('flags provider settlements that exceed our recorded net captures', function () {
    config([
        'services.razorpay.key' => 'rzp_test_recon',
        'services.razorpay.secret' => 'secret',
        'services.razorpay.webhook_secret' => 'whsec',
    ]);

    Http::fake([
        'api.razorpay.com/*' => Http::response([
            'entity' => 'collection',
            'count' => 1,
            'items' => [['id' => 'setl_recon_1', 'amount' => 900000, 'status' => 'processed']],
        ], 200),
    ]);

    $booking = reconRideBooking();
    app(PaymentService::class)->recordCapturedPayment([
        'payable' => $booking,
        'provider_payment_id' => 'pay_recon_prov',
        'amount_minor' => 250000,
        'method' => 'upi',
    ]);

    $report = recon()->run();

    expect($report['provider'])->toBe('ok');

    $mismatch = ReconciliationMismatch::open()
        ->where('type', ReconciliationMismatch::TYPE_PROVIDER_SETTLEMENT_MISMATCH)
        ->first();

    expect($mismatch)->not->toBeNull()
        ->and((int) $mismatch->actual_minor)->toBe(900000)
        ->and((int) $mismatch->expected_minor)->toBe(250000);
});

it('records provider_unreachable when settlements cannot be fetched', function () {
    config([
        'services.razorpay.key' => 'rzp_test_recon',
        'services.razorpay.secret' => 'secret',
        'services.razorpay.webhook_secret' => 'whsec',
    ]);

    Http::fake(['api.razorpay.com/*' => Http::response('upstream error', 500)]);

    $report = recon()->run();

    expect($report['provider'])->toBe('unreachable')
        ->and(ReconciliationMismatch::open()
            ->where('type', ReconciliationMismatch::TYPE_PROVIDER_UNREACHABLE)
            ->count())->toBe(1);
});

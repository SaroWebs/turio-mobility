<?php

use App\Models\Customer;
use App\Models\LedgerEntry;
use App\Models\Wallet;

it('posts a balanced double entry in integer minor units for each wallet movement', function () {
    $customer = Customer::create(['name' => 'DE Customer', 'phone' => '9200000001']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 0,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $txn = $wallet->credit(500, 'Top up', 'razorpay_payment', 'pay_1');

    $entries = LedgerEntry::where('transaction_ref', $txn->transaction_ref)->get();

    expect($entries)->toHaveCount(2)
        ->and((int) $entries->where('direction', 'credit')->sum('amount_minor'))->toBe(50000)
        ->and((int) $entries->where('direction', 'debit')->sum('amount_minor'))->toBe(50000)
        ->and((int) $wallet->fresh()->balance_minor)->toBe(50000)
        ->and((int) $txn->amount_minor)->toBe(50000);

    // The wallet leg carries wallet_id; the counterparty (system) leg does not.
    expect((int) $entries->firstWhere('direction', 'credit')->wallet_id)->toBe($wallet->id)
        ->and($entries->firstWhere('direction', 'debit')->wallet_id)->toBeNull();
});

it('keeps the global ledger balanced across many movements', function () {
    $customer = Customer::create(['name' => 'Balance Customer', 'phone' => '9200000002']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 0,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $wallet->credit(1000, 'Top up', 'razorpay_payment', 'pay_2');
    $wallet->debit(250.50, 'Ride', 'ride_booking', '10');
    $wallet->debit(99.99, 'Tip', 'ride_tip_10');

    $credits = (int) LedgerEntry::where('direction', 'credit')->sum('amount_minor');
    $debits = (int) LedgerEntry::where('direction', 'debit')->sum('amount_minor');

    expect($credits)->toBe($debits)
        ->and((int) $wallet->fresh()->balance_minor)->toBe(100000 - 25050 - 9999);
});

it('derives the wallet account balance purely from ledger entries', function () {
    $customer = Customer::create(['name' => 'Recon Customer', 'phone' => '9200000003']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 0,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $wallet->credit(300, 'Top up', 'razorpay_payment', 'pay_3');
    $wallet->debit(120, 'Ride', 'ride_booking', '11');

    $walletCredits = (int) LedgerEntry::where('wallet_id', $wallet->id)->where('direction', 'credit')->sum('amount_minor');
    $walletDebits = (int) LedgerEntry::where('wallet_id', $wallet->id)->where('direction', 'debit')->sum('amount_minor');

    expect($walletCredits - $walletDebits)->toBe((int) $wallet->fresh()->balance_minor)
        ->and($walletCredits - $walletDebits)->toBe(18000);
});

it('does not post ledger entries for an idempotent replay', function () {
    $customer = Customer::create(['name' => 'Idem Customer', 'phone' => '9200000004']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 0,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $wallet->credit(200, 'Top up', 'razorpay_payment', 'pay_4', 'idem-key-1');
    $wallet->credit(200, 'Top up retry', 'razorpay_payment', 'pay_4', 'idem-key-1');

    expect(LedgerEntry::count())->toBe(2)
        ->and((int) $wallet->fresh()->balance_minor)->toBe(20000);
});

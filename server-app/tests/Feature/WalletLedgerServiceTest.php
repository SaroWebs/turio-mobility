<?php

use App\Models\Customer;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\RazorpayService;
use Laravel\Sanctum\Sanctum;

it('records wallet credits and debits with balance snapshots', function () {
    $customer = Customer::create(['name' => 'Ledger Customer', 'phone' => '9100000001']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 100,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $credit = $wallet->credit(50, 'Top up', 'manual', 'topup-1');
    $debit = $wallet->debit(30, 'Booking payment', 'ride_booking', 'ride-1');

    expect((float) $wallet->fresh()->balance)->toBe(120.0)
        ->and((float) $credit->balance_before)->toBe(100.0)
        ->and((float) $credit->balance_after)->toBe(150.0)
        ->and((float) $debit->balance_before)->toBe(150.0)
        ->and((float) $debit->balance_after)->toBe(120.0);

    $this->assertDatabaseHas('wallet_transactions', [
        'wallet_id' => $wallet->id,
        'type' => 'credit',
        'amount' => 50,
        'reference_type' => 'manual',
        'reference_id' => 'topup-1',
        'status' => 'completed',
    ]);
});

it('returns the existing wallet transaction for a repeated idempotency key', function () {
    $customer = Customer::create(['name' => 'Idempotent Ledger Customer', 'phone' => '9100000004']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 100,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $first = $wallet->credit(75, 'Top up', 'razorpay_payment', 'pay_123', 'topup-key-123');
    $second = $wallet->credit(75, 'Top up retry', 'razorpay_payment', 'pay_123', 'topup-key-123');

    expect($second->id)->toBe($first->id)
        ->and((float) $wallet->fresh()->balance)->toBe(175.0);

    $this->assertDatabaseCount('wallet_transactions', 1);
    $this->assertDatabaseHas('wallet_transactions', [
        'id' => $first->id,
        'idempotency_key' => 'topup-key-123',
        'reference_type' => 'razorpay_payment',
        'reference_id' => 'pay_123',
    ]);
});

it('does not create a wallet transaction when debit fails', function () {
    $customer = Customer::create(['name' => 'Poor Ledger Customer', 'phone' => '9100000002']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 20,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    expect(fn () => $wallet->debit(50, 'Too much', 'ride_booking', 'ride-2'))
        ->toThrow(RuntimeException::class, 'Insufficient wallet balance.');

    expect((float) $wallet->fresh()->balance)->toBe(20.0);
    $this->assertDatabaseCount('wallet_transactions', 0);
});

it('rejects inactive wallets and non-positive amounts', function () {
    $customer = Customer::create(['name' => 'Inactive Ledger Customer', 'phone' => '9100000003']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 100,
        'currency' => 'INR',
        'is_active' => false,
    ]);

    expect(fn () => $wallet->credit(10, 'Inactive top up'))
        ->toThrow(RuntimeException::class, 'Wallet is inactive.');

    $wallet->update(['is_active' => true]);

    expect(fn () => $wallet->debit(0, 'Invalid debit'))
        ->toThrow(InvalidArgumentException::class, 'Wallet transaction amount must be greater than zero.');

    expect((float) $wallet->fresh()->balance)->toBe(100.0);
    expect(WalletTransaction::count())->toBe(0);
});

it('keeps wallet top-up verification idempotent across client retries', function () {
    $customer = Customer::create(['name' => 'Topup Retry Customer', 'phone' => '9100000005']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 0,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $this->mock(RazorpayService::class, function ($mock) {
        $mock->shouldReceive('verifySignature')->twice()->andReturnTrue();
        $mock->shouldReceive('fetchPayment')->twice()->andReturn([
            'id' => 'pay_retry_123',
            'order_id' => 'order_retry_123',
            'status' => 'captured',
            'amount' => 50000,
        ]);
        $mock->shouldReceive('fetchOrder')->twice()->andReturn([
            'id' => 'order_retry_123',
            'amount' => 50000,
        ]);
    });

    Sanctum::actingAs($customer);

    $payload = [
        'razorpay_order_id' => 'order_retry_123',
        'razorpay_payment_id' => 'pay_retry_123',
        'razorpay_signature' => 'valid-signature',
        'idempotency_key' => 'wallet-topup-retry-key',
    ];

    $first = $this->postJson('/api/customer-app/wallet/topup/verify', $payload)
        ->assertOk()
        ->assertJsonPath('data.wallet.balance', '500.00')
        ->json('data.transaction_id');

    $second = $this->postJson('/api/customer-app/wallet/topup/verify', $payload)
        ->assertOk()
        ->assertJsonPath('data.wallet.balance', '500.00')
        ->json('data.transaction_id');

    expect($second)->toBe($first)
        ->and((float) $wallet->fresh()->balance)->toBe(500.0);

    $this->assertDatabaseCount('wallet_transactions', 1);
    $this->assertDatabaseHas('wallet_transactions', [
        'wallet_id' => $wallet->id,
        'type' => 'credit',
        'amount' => 500,
        'reference_type' => 'razorpay_payment',
        'reference_id' => 'pay_retry_123',
        'idempotency_key' => 'wallet-topup-retry-key',
    ]);
});

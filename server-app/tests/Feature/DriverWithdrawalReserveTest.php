<?php

use App\Models\Customer;
use App\Models\Driver;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    config(['driver_wallet.withdrawal_reserve_minor' => 25000]);
    $this->driver = Driver::create(['name' => 'Reserve Driver', 'phone' => '919876540001', 'status' => 'active', 'is_active' => true, 'is_approved' => true]);
    $this->wallet = Wallet::create(['owner_type' => Driver::class, 'owner_id' => $this->driver->id,
        'balance' => 1000, 'balance_minor' => 100000, 'currency' => 'INR', 'is_active' => true]);
    $this->payload = ['amount' => 750, 'bank_account_name' => 'Reserve Driver', 'bank_account_number' => '123456789012', 'bank_ifsc' => 'HDFC0000001'];
    Sanctum::actingAs($this->driver);
});

it('holds only withdrawable funds and replays the same request without another debit', function () {
    $headers = ['Idempotency-Key' => 'reserve-exact-limit'];
    $first = $this->postJson('/api/driver-app/withdrawals', $this->payload, $headers)->assertOk();
    $this->postJson('/api/driver-app/withdrawals', $this->payload, $headers)->assertOk()->assertJsonPath('data.id', $first->json('data.id'));
    expect($this->wallet->fresh()->getBalanceMinor())->toBe(25000);
    expect(WithdrawalRequest::count())->toBe(1);
    expect($this->wallet->transactions()->count())->toBe(1);
    $this->getJson('/api/driver-app/wallet')->assertOk()->assertJsonPath('data.withdrawable_minor', 0)->assertJsonPath('data.withdrawal_reserve_minor', 25000);
});

it('rejects one paise above the limit without leaving a request or ledger movement', function () {
    $this->postJson('/api/driver-app/withdrawals', [...$this->payload, 'amount' => 750.01])->assertUnprocessable();
    expect(WithdrawalRequest::count())->toBe(0);
    expect($this->wallet->fresh()->getBalanceMinor())->toBe(100000);
    expect($this->wallet->transactions()->count())->toBe(0);
});

it('blocks withdrawals when the reserve policy is absent or invalid', function ($reserve) {
    config(['driver_wallet.withdrawal_reserve_minor' => $reserve]);
    $this->postJson('/api/driver-app/withdrawals', $this->payload)->assertUnprocessable();
    $this->getJson('/api/driver-app/wallet')->assertOk()->assertJsonPath('data.withdrawal_policy_configured', false)->assertJsonPath('data.withdrawable_minor', 0);
    expect(WithdrawalRequest::count())->toBe(0);
})->with([null, '', -1, 'not-a-number', '1.5', true]);

it('rechecks the authoritative balance even when the caller holds a stale wallet', function () {
    $stale = Wallet::findOrFail($this->wallet->id);
    $this->wallet->debit(700, 'First hold', 'driver_withdrawal', 'one', 'hold-one');
    expect(fn () => $stale->debit(100, 'Second hold', 'driver_withdrawal', 'two', 'hold-two'))->toThrow(ValidationException::class);
    expect($this->wallet->fresh()->getBalanceMinor())->toBe(30000);
});

it('does not subtract a pending hold twice and does not apply the driver reserve to customers', function () {
    $this->wallet->debit(100, 'Hold', 'driver_withdrawal', 'one', 'hold-one');
    $this->getJson('/api/driver-app/wallet')->assertOk()->assertJsonPath('data.withdrawable_minor', 65000);
    $customer = Customer::create(['name' => 'Customer', 'phone' => '919876540002']);
    $wallet = Wallet::create(['owner_type' => Customer::class, 'owner_id' => $customer->id, 'balance' => 100, 'is_active' => true]);
    $wallet->debit(100, 'Customer withdrawal', 'driver_withdrawal', 'customer-one');
    expect($wallet->fresh()->getBalanceMinor())->toBe(0);
});

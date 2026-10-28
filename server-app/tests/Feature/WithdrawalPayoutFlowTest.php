<?php

use App\Models\Customer;
use App\Models\LedgerEntry;
use App\Models\Role;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Services\RazorpayService;
use Laravel\Sanctum\Sanctum;

function adminUserForWithdrawalPayout(): User
{
    $admin = User::create([
        'name' => 'Withdrawal Admin',
        'email' => 'withdrawal-admin-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    return $admin;
}

it('creates a withdrawal and holds the wallet balance in payout clearing', function () {
    $customer = Customer::create(['name' => 'Withdrawal Customer', 'phone' => '9500000020']);
    $wallet = Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 1000,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    Sanctum::actingAs($customer);

    $this->postJson('/api/driver-app/withdrawals', [
        'amount' => 250,
        'bank_account_name' => 'Withdrawal Customer',
        'bank_account_number' => '1234567890',
        'bank_ifsc' => 'HDFC0001234',
        'bank_name' => 'Test Bank',
    ], ['Idempotency-Key' => 'withdrawal-hold-1'])
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'pending');

    expect((int) $wallet->fresh()->balance_minor)->toBe(75000)
        ->and(LedgerEntry::where('reference_type', 'driver_withdrawal')
            ->where('reference_id', WithdrawalRequest::firstOrFail()->id)
            ->count())->toBe(2);
});

it('approves a pending withdrawal and initiates a razorpay payout', function () {
    $admin = adminUserForWithdrawalPayout();
    $customer = Customer::create([
        'name' => 'Payout Customer',
        'email' => 'payout-customer-'.uniqid().'@example.com',
        'phone' => '9500000021',
    ]);
    $withdrawal = WithdrawalRequest::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'amount' => 250,
        'method' => 'bank_transfer',
        'account_details' => [
            'name' => 'Payout Customer',
            'account_number' => '1234567890',
            'ifsc' => 'HDFC0001234',
        ],
        'status' => 'pending',
    ]);

    $this->mock(RazorpayService::class, function ($mock) {
        $mock->shouldReceive('createContact')
            ->once()
            ->with('Payout Customer', Mockery::type('string'), '9500000021', 'vendor')
            ->andReturn(['id' => 'cont_1']);
        $mock->shouldReceive('createFundAccount')
            ->once()
            ->with('cont_1', 'Payout Customer', 'HDFC0001234', '1234567890')
            ->andReturn(['id' => 'fa_1']);
        $mock->shouldReceive('createPayout')
            ->once()
            ->with(250.0, 'fa_1', 'payout', Mockery::type('string'))
            ->andReturn(['id' => 'pout_1']);
    });

    $this->actingAs($admin)
        ->post("/admin/financials/withdrawals/{$withdrawal->id}/approve")
        ->assertRedirect()
        ->assertSessionHas('success');

    expect($withdrawal->fresh()->status)->toBe('processing')
        ->and($withdrawal->fresh()->razorpay_fund_account_id)->toBe('fa_1')
        ->and($withdrawal->fresh()->razorpay_payout_id)->toBe('pout_1')
        ->and($withdrawal->fresh()->payout->provider_payout_id)->toBe('pout_1');
});

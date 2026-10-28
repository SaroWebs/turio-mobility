<?php

use App\Models\Driver;
use Laravel\Sanctum\Sanctum;

it('credits the exact simulated driver top-up and deduplicates retries', function (float $amount) {
    config(['services.razorpay.simulation' => true]);
    $driver = Driver::forceCreate([
        'name' => 'Wallet Driver',
        'phone' => '9876543210',
        'is_active' => true,
    ]);
    Sanctum::actingAs($driver);

    $orderId = $this->postJson('/api/driver-app/wallet/topup/order', ['amount' => $amount])
        ->assertOk()->assertJsonPath('data.is_simulation', true)->json('data.order_id');
    $payload = [
        'razorpay_order_id' => $orderId,
        'razorpay_payment_id' => 'pay_demo_'.$orderId,
        'razorpay_signature' => 'sig_demo_'.$orderId,
    ];

    for ($attempt = 0; $attempt < 2; $attempt++) {
        $this->postJson('/api/driver-app/wallet/topup/verify', $payload)
            ->assertOk()
            ->assertJsonPath('data.wallet.balance', number_format($amount, 2, '.', ''))
            ->assertJsonPath('data.wallet.balance_minor', (int) round($amount * 100));
    }

    $this->getJson('/api/driver-app/wallet')->assertOk()
        ->assertJsonPath('data.balance_minor', (int) round($amount * 100));
    $this->assertDatabaseCount('wallet_transactions', 1);
    expect($driver->fresh()->funding_eligible)->toBeTrue();
})->with([500.0, 1000.0, 1234.56]);

<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\PaymentOrder;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DriverFundingService
{
    public function createTopUpOrder(Driver $driver, int $amountMinor): array
    {
        $wallet = Wallet::firstOrCreate(
            ['owner_type' => $driver::class, 'owner_id' => $driver->id],
            [
                'balance' => 0,
                'currency' => 'INR',
                'is_active' => true,
            ]
        );

        $paymentService = app(PaymentService::class);
        $razorpayService = app(RazorpayService::class);

        $order = $paymentService->createOrder($amountMinor, null, $driver, [
            'notes' => ['purpose' => 'driver_topup'],
        ]);

        $receipt = 'TOPUP_'.$driver->id.'_'.Str::random(8);

        $razorpayOrder = $razorpayService->createOrder(
            $amountMinor / 100,
            $receipt,
            ['purpose' => 'driver_topup', 'payment_order_id' => (string) $order->id]
        );

        $order->update([
            'provider_order_id' => $razorpayOrder['id'],
            'receipt' => $receipt,
        ]);

        return [
            'order_id' => $razorpayOrder['id'],
            'id' => $razorpayOrder['id'],
            'amount' => $amountMinor / 100,
            'currency' => 'INR',
            'receipt' => $receipt,
            'is_simulation' => rescue(fn () => $razorpayService->isSimulationMode(), false, false),
            'razorpay_config' => $razorpayService->getClientConfig(),
        ];
    }

    public function verifyTopUp(Driver $driver, string $orderId, string $paymentId, string $signature, ?string $idempotencyKey = null)
    {
        $local = PaymentOrder::where('provider', 'razorpay')->where('provider_order_id', $orderId)
            ->where('owner_type', Driver::class)->where('owner_id', $driver->id)->firstOrFail();
        abort_unless(($local->notes['purpose'] ?? null) === 'driver_topup' && ! $local->payable_id, 422);
        $gateway = app(RazorpayService::class);
        abort_unless($gateway->verifySignature($orderId, $paymentId, $signature), 422, 'Invalid payment signature.');
        $capture = $gateway->fetchPayment($paymentId);
        $remote = $gateway->fetchOrder($orderId);
        abort_unless(($remote['id'] ?? null) === $orderId && ($remote['currency'] ?? null) === 'INR'
            && (int) ($remote['amount'] ?? 0) === (int) $local->amount_minor, 422, 'Order mismatch.');

        abort_unless(($capture['id'] ?? null) === $paymentId, 422, 'Payment identity mismatch.');

        return $this->capture($local, $capture);
    }

    /** Shared by verified checkout and authenticated provider webhooks. */
    public function capture(PaymentOrder $order, array $capture)
    {
        return DB::transaction(function () use ($order, $capture) {
            $order = PaymentOrder::whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_unless($order->provider === 'razorpay' && $order->owner_type === Driver::class
                && ! $order->payable_id && ($order->notes['purpose'] ?? null) === 'driver_topup'
                && ($capture['order_id'] ?? null) === $order->provider_order_id
                && ($capture['status'] ?? null) === 'captured' && ($capture['currency'] ?? null) === 'INR'
                && (int) ($capture['amount'] ?? 0) === (int) $order->amount_minor, 422, 'Capture mismatch.');
            $driver = Driver::findOrFail($order->owner_id);
            $existing = \App\Models\Payment::where('provider_payment_id', $capture['id'])->first();
            abort_if($existing && (int) $existing->payment_order_id !== (int) $order->id, 422, 'Capture already belongs to another order.');
            app(PaymentService::class)->recordCapturedPayment([
                'order' => $order, 'owner' => $driver, 'provider_payment_id' => $capture['id'],
                'amount_minor' => (int) $capture['amount'], 'currency' => 'INR', 'method' => $capture['method'] ?? null,
            ]);
            $wallet = Wallet::firstOrCreate(['owner_type' => Driver::class, 'owner_id' => $driver->id],
                ['balance' => 0, 'currency' => 'INR', 'is_active' => true]);
            $transaction = $wallet->credit($order->amount_minor / 100, 'Driver online top-up',
                'razorpay_payment', $capture['id'], 'razorpay_payment:'.$capture['id']);
            $this->activateFundingIfEligible($driver);

            return $transaction;
        });
    }

    public function activateFundingIfEligible(Driver $driver): void
    {
        $minimum = filter_var(setting('driver.minimum_topup_minor'), FILTER_VALIDATE_INT);
        if ($minimum === false || $minimum <= 0) {
            return;
        }
        $received = \App\Models\Payment::where('owner_type', Driver::class)->where('owner_id', $driver->id)
            ->where('provider', 'razorpay')->whereNotNull('captured_at')->whereHas('order', fn ($q) => $q->where('notes->purpose', 'driver_topup'))->sum('amount_minor');
        if ($received >= $minimum && ! $driver->funding_eligible) {
            $driver->update(['funding_eligible' => true, 'funding_activated_at' => now()]);
        }
    }
}

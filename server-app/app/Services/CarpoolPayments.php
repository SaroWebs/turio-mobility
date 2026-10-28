<?php

namespace App\Services;

use App\Models\CarpoolBooking;
use App\Models\CarpoolRide;
use App\Models\Payment;
use App\Models\PaymentOrder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class CarpoolPayments
{
    public function testMode(): bool
    {
        return app()->environment(['local', 'testing']) && config('carpool.test_payments');
    }

    public function available(): bool
    {
        return $this->testMode() || (config('carpool.online_enabled') && is_a(config('carpool.payout_adapter') ?? '', CarpoolSettlementProvider::class, true) && filled(config('services.razorpay.key')) && filled(config('services.razorpay.secret')) && filled(config('services.razorpay.webhook_secret')));
    }

    public function checkout(Model $actor, int $id): PaymentOrder
    {
        app(CarpoolService::class)->actor($actor);
        $stub = CarpoolBooking::findOrFail($id);

        return DB::transaction(function () use ($stub, $actor) {
            CarpoolRide::lockForUpdate()->findOrFail($stub->carpool_ride_id);
            $b = CarpoolBooking::lockForUpdate()->findOrFail($stub->id);
            abort_unless(app(CarpoolService::class)->passenger($b, $actor), 403);
            abort_unless($b->status === 'reserved' && $b->expires_at->gt(now()) && $b->payment_method === 'online' && $this->available(), 409, 'Checkout unavailable or reservation expired.');
            abort_unless($b->currency === 'INR', 422, 'The existing provider adapter supports INR only.');
            if ($order = $b->orders()->first()) {
                return $order;
            }
            $order = app(PaymentService::class)->createOrder($b->total_minor, $b, $actor, ['provider' => $this->testMode() ? 'carpool_test' : 'razorpay', 'currency' => $b->currency, 'idempotency_key' => 'carpool:'.$b->id]);

            // Persist intent before the network call. An ambiguous failure needs reconciliation,
            // never another order. Provider calls are performed by prepareOrder below.
            return $order;
        }, 5);
    }

    public function prepareOrder(PaymentOrder $order): PaymentOrder
    {
        if ($order->provider_order_id) {
            return $order;
        }
        $claimed = PaymentOrder::whereKey($order->id)->where('status', 'created')->update(['status' => 'attempted']);
        abort_unless($claimed, 409, 'Payment order is being prepared or needs provider reconciliation.');
        if ($order->provider === 'carpool_test') {
            $order->update(['provider_order_id' => 'carpool_test_'.$order->id]);
        } else {
            $remote = app(RazorpayService::class)->createOrder($order->amount_minor / 100, 'carpool_'.$order->id, ['purpose' => 'carpool', 'order_id' => $order->id]);
            $order->update(['provider_order_id' => $remote['id']]);
        }

        return $order->fresh();
    }

    public function capture(PaymentOrder $order, string $paymentId, int $amount, string $currency): void
    {
        abort_unless($order->payable_type === CarpoolBooking::class && $amount === $order->amount_minor && $currency === $order->currency, 422, 'Payment does not match the order.');
        $stub = CarpoolBooking::findOrFail($order->payable_id);
        DB::transaction(function () use ($stub, $order, $paymentId, $amount, $currency) {
            $ride = CarpoolRide::lockForUpdate()->findOrFail($stub->carpool_ride_id);
            $b = CarpoolBooking::lockForUpdate()->findOrFail($stub->id);
            if ($existing = Payment::where('provider_payment_id', $paymentId)->first()) {
                abort_unless($existing->payment_order_id === $order->id && $existing->amount_minor === $amount, 409);

                return;
            }
            // One provider order can have multiple captures; preserve every liability.
            $valid = $b->status === 'reserved' && $b->expires_at->gt(now()) && $ride->status === 'published' && $ride->departure_at->gt(now()) && $b->payment_status !== 'paid';
            $payment = app(PaymentService::class)->recordCapturedPayment(['provider' => $order->provider, 'provider_payment_id' => $paymentId,
                'payable' => $b, 'owner' => $b->passenger, 'order' => $order, 'amount_minor' => $amount, 'currency' => $currency, 'method' => 'online',
                'notes' => ['service' => 'carpool', 'late_capture' => ! $valid, 'refund_due_minor' => $valid ? 0 : $amount]]);
            app(LedgerService::class)->post('system:gateway_clearing', $valid ? 'system:booking_revenue' : 'system:refunds_pending', $amount,
                ['reference_type' => CarpoolBooking::class, 'reference_id' => (string) $b->id, 'currency' => $currency, 'description' => 'Carpool capture #'.$payment->id]);
            if ($valid) {
                $b->update(['status' => 'confirmed', 'payment_status' => 'paid', 'expires_at' => null]);
                app(CarpoolService::class)->notify($b, 'confirmed');
            } else {
                if ($b->status === 'reserved') {
                    $b->status = 'expired';
                }
                $b->refund_status = 'pending';
                $b->refund_minor += $amount;
                $b->save();
            }
            app(CarpoolService::class)->audit($b, 'payment.captured', null, ['payment_id' => $payment->id, 'late' => ! $valid]);
        }, 5);
    }

    public function fail(PaymentOrder $order): void
    {
        $stub = CarpoolBooking::findOrFail($order->payable_id);
        DB::transaction(function () use ($stub, $order) {
            CarpoolRide::lockForUpdate()->findOrFail($stub->carpool_ride_id);
            $b = CarpoolBooking::lockForUpdate()->findOrFail($stub->id);
            if ($b->status === 'reserved' && $b->payment_status !== 'paid') {
                $b->update(['status' => 'expired', 'payment_status' => 'failed']);
            }
            $order->markFailed();
        }, 5);
    }

    public function cash(CarpoolBooking $b): void
    {
        Payment::firstOrCreate(['provider_payment_id' => 'carpool_cash_'.$b->id], ['provider' => 'cash', 'payable_type' => $b::class, 'payable_id' => $b->id,
            'owner_type' => $b->passenger_type, 'owner_id' => $b->passenger_id, 'amount_minor' => $b->total_minor, 'currency' => $b->currency,
            'method' => 'cash', 'status' => 'captured', 'captured_at' => now(), 'notes' => ['service' => 'carpool', 'direct_to_driver' => true]]);
        $b->update(['payment_status' => 'collected', 'payout_status' => 'not_applicable']);
    }

    public function eligible(CarpoolBooking $b): bool
    {
        return $b->payment_method === 'online' && $b->payment_status === 'paid' && $b->status === 'confirmed'
            && $b->ride->status === 'completed' && $b->attendance === 'checked_in' && $b->payout_eligible_at?->lte(now())
            && $b->refund_status !== 'pending' && ! DB::table('carpool_complaints')->where('carpool_booking_id', $b->id)->where('status', 'open')->exists();
    }

    public function settle(int $id): void
    {
        $stub = CarpoolBooking::findOrFail($id);
        DB::transaction(function () use ($stub) {
            CarpoolRide::lockForUpdate()->findOrFail($stub->carpool_ride_id);
            $b = CarpoolBooking::lockForUpdate()->findOrFail($stub->id);
            $payments = $b->payments()->where('method', 'online')->get();
            $test = $payments->isNotEmpty() && $payments->every(fn ($p) => $p->provider === 'carpool_test') && $this->testMode();
            if (! $test && ! config('carpool.payout_adapter')) {
                return;
            }
            $adapter = $test ? null : app(config('carpool.payout_adapter'));
            if ($b->refund_status === 'pending') {
                foreach ($payments as $p) {
                    $amount = (int) ($p->notes['refund_due_minor'] ?? 0);
                    if ($amount <= $p->amount_refunded_minor) {
                        continue;
                    }
                    $delta = $amount - $p->amount_refunded_minor;
                    $reference = $test ? 'test_refund_'.$p->id.'_'.$amount : $adapter->refund($p, $delta, 'carpool_refund_'.$p->id.'_'.$amount);
                    $this->recordRefund($p, $delta, $reference);
                    app(CarpoolService::class)->audit($b, 'refund.verified', null, ['reference' => $reference, 'test' => $test]);
                }
                $b->refresh();
            }
            if ($this->eligible($b) && ! in_array($b->payout_status, ['paid', 'test_paid'])) {
                $reference = $test ? 'test_payout_'.$b->id : $adapter->payout($b, $b->contribution_minor, 'carpool_payout_'.$b->id);
                app(LedgerService::class)->post('system:booking_revenue', 'system:payout_clearing', $b->contribution_minor,
                    ['reference_type' => CarpoolBooking::class, 'reference_id' => (string) $b->id, 'currency' => $b->currency, 'description' => 'Carpool payout '.$reference]);
                $b->update(['payout_status' => $test ? 'test_paid' : 'paid']);
                app(CarpoolService::class)->audit($b, 'payout.verified', null, ['reference' => $reference, 'test' => $test]);
            }
        }, 5);
    }

    public function recordRefund(Payment $payment, int $amount, string $reference): void
    {
        $stub = CarpoolBooking::findOrFail($payment->payable_id);
        DB::transaction(function () use ($stub, $payment, $amount, $reference) {
            CarpoolRide::lockForUpdate()->findOrFail($stub->carpool_ride_id);
            $b = CarpoolBooking::lockForUpdate()->findOrFail($stub->id);
            $p = Payment::lockForUpdate()->findOrFail($payment->id);
            $notes = $p->notes ?? [];
            $seen = $notes['verified_refunds'] ?? [];
            if (isset($seen[$reference])) {
                abort_unless($seen[$reference] === $amount, 409);

                return;
            }
            abort_unless($amount > 0 && $amount + $p->amount_refunded_minor <= $p->amount_minor, 422, 'Refund exceeds captured amount.');
            $seen[$reference] = $amount;
            $total = $p->amount_refunded_minor + $amount;
            $p->update(['amount_refunded_minor' => $total, 'status' => $total === $p->amount_minor ? 'refunded' : 'partially_refunded', 'notes' => [...$notes, 'verified_refunds' => $seen]]);
            app(LedgerService::class)->post(($notes['late_capture'] ?? false) ? 'system:refunds_pending' : 'system:booking_revenue', 'system:gateway_clearing', $amount,
                ['reference_type' => CarpoolBooking::class, 'reference_id' => (string) $b->id, 'currency' => $b->currency, 'description' => 'Carpool refund '.$reference]);
            $pending = $b->payments()->get()->sum(fn ($p) => max(0, ($p->notes['refund_due_minor'] ?? 0) - $p->amount_refunded_minor));
            $b->refund_status = $pending ? 'pending' : 'refunded';
            if (! ($notes['late_capture'] ?? false)) {
                $b->payment_status = $total === $p->amount_minor ? 'refunded' : 'partially_refunded';
                $b->payout_status = in_array($b->payout_status, ['paid', 'test_paid', 'recovery_required']) ? 'recovery_required' : 'ineligible';
                if ($b->ride->status === 'published') {
                    $b->status = 'cancelled';
                }
            }
            $b->save();
            app(CarpoolService::class)->notify($b, 'refund_processed');
        }, 5);
    }
}

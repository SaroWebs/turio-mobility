<?php

namespace App\Jobs;

use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\PaymentOrder;
use App\Models\Payout;
use App\Models\RazorpayWebhookEvent;
use App\Models\Wallet;
use App\Services\LedgerService;
use App\Services\PaymentService;
use App\Support\Money;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Applies the side effects of a stored Razorpay webhook event (SKY-MRD-001
 * §8.7). Idempotent: skips already-processed events, and every money mutation
 * it performs is itself idempotent (wallet idempotency key / provider_payment_id),
 * so a redelivery or retry never double-applies.
 */
class ProcessRazorpayWebhookEvent implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 5;

    public array $backoff = [10, 30, 60, 300];

    public function __construct(public int $eventId) {}

    public function handle(PaymentService $payments, LedgerService $ledger): void
    {
        $event = RazorpayWebhookEvent::find($this->eventId);

        if (! $event || $event->isProcessed()) {
            return; // gone or already applied — nothing to do
        }

        $event->markProcessing();

        try {
            match ($event->event_type) {
                'payment.captured' => $this->handlePaymentCaptured($event, $payments),
                'payment.failed' => $this->handlePaymentFailed($event, $payments),
                'refund.created', 'refund.processed' => $this->handleRefund($event, $ledger),
                'payout.processed' => $this->handlePayoutProcessed($event, $payments),
                'payout.failed', 'payout.reversed' => $this->handlePayoutTerminal($event),
                default => $event->markIgnored('Unhandled event type: '.(string) $event->event_type),
            };
        } catch (\Throwable $e) {
            // Redact detail: log the class + our event id only, never the payload.
            Log::error('Razorpay webhook processing failed', [
                'event_row_id' => $event->id,
                'event_type' => $event->event_type,
                'exception' => $e::class,
            ]);
            $event->markFailed($e::class);
            throw $e; // let the queue retry/backoff apply
        }
    }

    private function handlePaymentCaptured(RazorpayWebhookEvent $event, PaymentService $payments): void
    {
        $entity = data_get($event->payload, 'payload.payment.entity', []);
        $paymentId = $entity['id'] ?? null;
        $orderId = $entity['order_id'] ?? null;
        $amountMinor = (int) ($entity['amount'] ?? 0);
        $method = $entity['method'] ?? null;
        $notes = $entity['notes'] ?? [];

        // Wallet top-up: created by createTopUpOrder with wallet_id in notes.
        $walletId = $notes['wallet_id'] ?? null;
        if ($walletId && ($notes['purpose'] ?? null) === 'wallet_topup') {
            $this->creditWalletTopUp((int) $walletId, $amountMinor, (string) $paymentId);
            $event->markProcessed();

            return;
        }

        // Booking / general order: match our PaymentOrder by provider order id.
        $order = $orderId ? PaymentOrder::where('provider_order_id', $orderId)->first() : null;

        if (! $order) {
            // Nothing we can attribute this capture to yet (e.g. minimal/test
            // event, or an order type not wired). Keep the raw row for backfill.
            $event->markIgnored('No matching payment order for capture');

            return;
        }

        if (($order->notes['purpose'] ?? null) === 'driver_topup') {
            app(\App\Services\DriverFundingService::class)->capture($order, $entity);
            $event->markProcessed();

            return;
        }

        if ($order->payable_type === \App\Models\CarpoolBooking::class) {
            app(\App\Services\CarpoolPayments::class)->capture($order, (string) $paymentId, $amountMinor, $entity['currency'] ?? $order->currency);
            $event->markProcessed();

            return;
        }

        $payable = $order->payable;
        $owner = $order->owner;

        $payments->recordCapturedPayment([
            'order' => $order,
            'payable' => $payable,
            'owner' => $owner,
            'provider' => 'razorpay',
            'provider_payment_id' => $paymentId,
            'provider_order_id' => $orderId,
            'amount_minor' => $amountMinor,
            'currency' => $entity['currency'] ?? $order->currency,
            'method' => $method,
        ]);

        $event->markProcessed();
    }

    private function handlePaymentFailed(RazorpayWebhookEvent $event, PaymentService $payments): void
    {
        $entity = data_get($event->payload, 'payload.payment.entity', []);
        $orderId = $entity['order_id'] ?? null;
        $order = $orderId ? PaymentOrder::where('provider_order_id', $orderId)->first() : null;

        if ($order?->payable_type === \App\Models\CarpoolBooking::class) {
            app(\App\Services\CarpoolPayments::class)->fail($order);
            $event->markProcessed();

            return;
        }

        $payments->markPaymentFailed([
            'order' => $order,
            'provider' => 'razorpay',
            'provider_payment_id' => $entity['id'] ?? null,
            'provider_order_id' => $orderId,
            'amount_minor' => (int) ($entity['amount'] ?? 0),
            'error_code' => $entity['error_code'] ?? null,
            'error_description' => $entity['error_description'] ?? null,
        ]);

        $event->markProcessed();
    }

    /** Credit a wallet for a captured top-up, idempotent on the provider payment id. */
    private function creditWalletTopUp(int $walletId, int $amountMinor, string $paymentId): void
    {
        $wallet = Wallet::find($walletId);

        if (! $wallet || $amountMinor <= 0) {
            return;
        }

        $wallet->credit(
            Money::toMajor($amountMinor),
            'Wallet top-up via Razorpay',
            'razorpay_payment',
            $paymentId,
            'razorpay_webhook:'.$paymentId,
        );
    }

    /**
     * Apply a provider-confirmed refund to its captured payment and post the
     * reversing ledger pair (Dr system:refunds / Cr system:gateway_clearing).
     * Idempotent on the refund id: a redelivery that already has a ledger entry
     * posts nothing new.
     */
    private function handleRefund(RazorpayWebhookEvent $event, LedgerService $ledger): void
    {
        $refund = data_get($event->payload, 'payload.refund.entity', []);
        $refundId = $refund['id'] ?? null;
        $paymentId = $refund['payment_id'] ?? null;
        $amountMinor = (int) ($refund['amount'] ?? 0);

        $payment = $paymentId
            ? Payment::where('provider_payment_id', $paymentId)->first()
            : null;

        if (! $payment || $amountMinor <= 0) {
            $event->markIgnored('No matching captured payment for refund');

            return;
        }

        if ($payment->payable_type === \App\Models\CarpoolBooking::class) {
            if ($event->event_type !== 'refund.processed' || ! $refundId) {
                $event->markIgnored('Carpool refunds require a processed provider refund ID');

                return;
            }
            app(\App\Services\CarpoolPayments::class)->recordRefund($payment, $amountMinor, $refundId);
            $event->markProcessed();

            return;
        }

        $reference = $refundId ?: $paymentId;

        // Idempotency: if this refund is already in the ledger, do nothing more.
        $alreadyPosted = LedgerEntry::where('reference_type', 'razorpay_refund')
            ->where('reference_id', $reference)
            ->exists();

        if (! $alreadyPosted) {
            DB::transaction(function () use ($payment, $ledger, $amountMinor, $reference) {
                $payment->applyRefund($amountMinor);

                $ledger->post('system:refunds', 'system:gateway_clearing', $amountMinor, [
                    'reference_type' => 'razorpay_refund',
                    'reference_id' => $reference,
                    'description' => 'Razorpay refund '.$reference,
                    'currency' => $payment->currency,
                ]);
            });
        }

        $event->markProcessed();
    }

    /** Confirm a driver payout succeeded; delegates to the idempotent service. */
    private function handlePayoutProcessed(RazorpayWebhookEvent $event, PaymentService $payments): void
    {
        $entity = data_get($event->payload, 'payload.payout.entity', []);
        $payoutId = $entity['id'] ?? null;
        $utr = $entity['utr'] ?? null;

        $payout = $payoutId
            ? Payout::where('provider_payout_id', $payoutId)->first()
            : null;

        if (! $payout) {
            $event->markIgnored('No matching payout for payout.processed');

            return;
        }

        $payments->markPayoutProcessed($payout, $utr ? (string) $utr : null);

        $event->markProcessed();
    }

    /** Move a payout to a terminal failed/reversed state (idempotent per model). */
    private function handlePayoutTerminal(RazorpayWebhookEvent $event): void
    {
        $entity = data_get($event->payload, 'payload.payout.entity', []);
        $payoutId = $entity['id'] ?? null;

        $payout = $payoutId
            ? Payout::where('provider_payout_id', $payoutId)->first()
            : null;

        if (! $payout) {
            $event->markIgnored('No matching payout for payout terminal event');

            return;
        }

        if ($event->event_type === 'payout.reversed') {
            $payout->markReversed();
        } else {
            $payout->markFailed(
                $entity['status_details']['reason'] ?? null,
                $entity['status_details']['description'] ?? null,
            );
        }

        // Release the wallet hold and fail the originating withdrawal. The hold
        // (wallet → system:payout_clearing) was posted at request time; crediting
        // it back with the 'driver_withdrawal' ref nets clearing to zero. This
        // shares its idempotency key with the admin-reject path
        // ('withdrawal_release:{id}') and is gated on a non-terminal withdrawal,
        // so a manual rejection and this webhook can never double-release the hold.
        $withdrawal = $payout->withdrawalRequest;
        if ($withdrawal && ! $withdrawal->isRejected() && ! $withdrawal->isCompleted()) {
            $wallet = Wallet::forOwner($withdrawal->owner)->first();
            if ($wallet) {
                $wallet->credit(
                    Money::toMajor($payout->amount_minor),
                    'Payout failed — withdrawal refund #'.$withdrawal->id,
                    'driver_withdrawal',
                    (string) $withdrawal->id,
                    'withdrawal_release:'.$withdrawal->id,
                );
            }

            $reason = $entity['status_details']['description']
                ?? $entity['status_details']['reason']
                ?? 'payout '.$event->event_type;
            $withdrawal->markAsFailed((string) $reason);
        }

        $event->markProcessed();
    }
}

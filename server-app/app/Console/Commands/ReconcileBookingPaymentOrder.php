<?php

namespace App\Console\Commands;

use App\Models\PaymentOrder;
use App\Models\RazorpayWebhookEvent;
use App\Services\RazorpayService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ReconcileBookingPaymentOrder extends Command
{
    protected $signature = 'booking-payments:reconcile-order {intent : Local payment order ID} {provider_order : Provider order ID from the merchant dashboard}';

    protected $description = 'Verify and recover a booking order after an uncertain provider response; replay retained matching captures.';

    public function handle(RazorpayService $gateway): int
    {
        $id = (string) $this->argument('provider_order');
        if (! preg_match('/^order_[A-Za-z0-9]+$/', $id)) {
            $this->error('Invalid provider order ID.');

            return self::FAILURE;
        }
        $order = PaymentOrder::findOrFail($this->argument('intent'));
        if (($order->notes['purpose'] ?? null) !== 'booking' || ! $order->payable || $order->provider !== 'razorpay') {
            $this->error('This is not a booking checkout intent.');

            return self::FAILURE;
        }
        $provider = $gateway->fetchOrder($id);
        if (($provider['id'] ?? null) !== $id || ($provider['receipt'] ?? null) !== $order->order_number
            || ($provider['amount'] ?? null) !== $order->amount_minor || ($provider['currency'] ?? null) !== $order->currency
            || (string) data_get($provider, 'notes.payment_order_id') !== (string) $order->id) {
            $this->error('Provider order does not match the durable booking intent. No changes made.');

            return self::FAILURE;
        }
        $linked = DB::transaction(function () use ($order, $id) {
            $locked = PaymentOrder::lockForUpdate()->findOrFail($order->id);
            if ($locked->provider_order_id && $locked->provider_order_id !== $id) {
                return false;
            }
            $locked->update(['provider_order_id' => $id, 'receipt' => $locked->order_number,
                'notes' => [...($locked->notes ?? []), 'checkout_state' => 'ready', 'reconciled_at' => now()->toIso8601String()]]);

            return true;
        });
        if (! $linked) {
            $this->error('The intent is already linked to a different provider order.');

            return self::FAILURE;
        }
        RazorpayWebhookEvent::where('event_type', 'payment.captured')->where('status', 'ignored')
            ->each(function ($event) use ($id) {
                if (data_get($event->payload, 'payload.payment.entity.order_id') === $id) {
                    $event->update(['status' => 'received']);
                    \App\Jobs\ProcessRazorpayWebhookEvent::dispatch($event->id);
                }
            });
        $this->info('Provider order verified and linked. Retained matching captures queued for reconciliation; this command does not declare a payment captured.');

        return self::SUCCESS;
    }
}

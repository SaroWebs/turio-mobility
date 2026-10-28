<?php

namespace App\Models\Concerns;

use App\Models\Payment;
use App\Models\PaymentOrder;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Gives a booking model its polymorphic link to the payment domain
 * (SKY-MRD-001 §6.1) so payment state lives in the payments tables while the
 * booking keeps its mirrored `payment_status` column for legacy clients.
 */
trait HasPaymentRelations
{
    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    public function paymentOrders(): MorphMany
    {
        return $this->morphMany(PaymentOrder::class, 'payable');
    }

    public function latestPayment(): ?Payment
    {
        /** @var Payment|null $payment */
        $payment = $this->payments()->latest()->first();

        return $payment;
    }
}

<?php

namespace App\Services;

use App\Models\CarpoolBooking;
use App\Models\Payment;

/** Production adapter must use provider-side idempotency and return only verified outcomes. */
interface CarpoolSettlementProvider
{
    public function refund(Payment $payment, int $amountMinor, string $idempotencyKey): string;

    public function payout(CarpoolBooking $booking, int $amountMinor, string $idempotencyKey): string;
}

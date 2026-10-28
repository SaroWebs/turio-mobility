<?php

namespace App\Http\Resources\V1;

use App\Http\Resources\V1\Concerns\FormatsMoney;
use App\Models\RideBooking;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Versioned ride-booking receipt (SKY-MRD-001 §9). Reference implementation of
 * the v1 conventions: money as {amount_minor, currency}, timestamps as ISO-8601.
 *
 * The authoritative amount is the captured Payment (already stored in minor
 * units on the double-entry ledger); we fall back to converting the booking
 * fare to paise only when no payment row exists yet.
 *
 * @mixin RideBooking
 */
class ReceiptResource extends JsonResource
{
    use FormatsMoney;

    public function toArray(Request $request): array
    {
        $payment = $this->latestPayment();
        $currency = $payment?->currency ?? 'INR';

        $amountMinor = $payment?->amount_minor
            ?? (int) round((float) $this->total_fare * 100);

        return [
            'id' => $this->id,
            'type' => 'ride',
            'booking_number' => $this->booking_number,
            'status' => $this->status,
            'payment_status' => $this->payment_status,
            'amount' => $this->money($amountMinor, $currency),
            'refunded' => $this->money((int) ($payment?->amount_refunded_minor ?? 0), $currency),
            'issued_at' => $this->created_at?->toIso8601String(),
            'travel_date' => $this->scheduled_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
        ];
    }
}

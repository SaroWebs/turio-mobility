<?php

namespace App\Services;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BookingQuoteService
{
    private function fingerprint(Request $request): string
    {
        $payload = $request->except(['quote_token', 'payment_method']);
        ksort($payload);

        return hash('sha256', json_encode($payload, JSON_PRESERVE_ZERO_FRACTION));
    }

    public function issue(Request $request, string $kind, array $price): array
    {
        $id = (string) Str::uuid();
        $expires = now()->addMinutes(10);
        $snapshot = $price['pricing_components'] ?? $price;
        $claims = [
            'id' => $id,
            'expires' => $expires->timestamp,
            'kind' => $kind,
            'customer' => $request->user()->getAuthIdentifier(),
            'fingerprint' => $this->fingerprint($request),
            'amount_minor' => Money::toMinor($price['total']),
            'pricing_snapshot' => $snapshot,
        ];

        return [
            ...$price,
            'quote_id' => $id,
            'currency' => 'INR',
            'amount_minor' => $claims['amount_minor'],
            'expires_at' => $expires->toIso8601String(),
            'quote_token' => Crypt::encryptString(json_encode($claims)),
            'pricing_snapshot' => $snapshot,
        ];
    }

    public function verify(Request $request, string $kind, ?float $total = null): ?array
    {
        // Old clients remain compatible; the new web flow always submits a signed quote.
        if (! $request->filled('quote_token')) {
            if ((int) $request->header('X-Booking-Contract', 1) >= 2) {
                throw ValidationException::withMessages(['quote_token' => 'Review a current quote before booking.']);
            }

            return null;
        }
        try {
            $claims = json_decode(Crypt::decryptString($request->string('quote_token')->toString()), true, flags: JSON_THROW_ON_ERROR);
            $valid = $claims['expires'] > now()->timestamp && $claims['kind'] === $kind
                && (string) $claims['customer'] === (string) $request->user()->getAuthIdentifier()
                && hash_equals($claims['fingerprint'], $this->fingerprint($request));
            if ($total !== null) {
                $valid = $valid && $claims['amount_minor'] === Money::toMinor($total);
            }
        } catch (\Throwable) {
            $valid = false;
        }
        if (! $valid) {
            throw ValidationException::withMessages(['quote_token' => 'This price has changed or expired. Check the latest price to continue.']);
        }

        return $claims;
    }
}

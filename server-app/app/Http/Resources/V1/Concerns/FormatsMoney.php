<?php

namespace App\Http\Resources\V1\Concerns;

/**
 * Canonical v1 money formatting (SKY-MRD-001 money invariant): all amounts are
 * integer minor units (paise) with an explicit ISO-4217 currency. A display
 * string in major units is included for convenience — clients must compute from
 * `amount_minor`, never from `amount_display`.
 */
trait FormatsMoney
{
    /**
     * @return array{amount_minor: int, currency: string, amount_display: string}
     */
    protected function money(int $minor, string $currency = 'INR'): array
    {
        return [
            'amount_minor' => $minor,
            'currency' => $currency,
            'amount_display' => number_format($minor / 100, 2, '.', ''),
        ];
    }
}

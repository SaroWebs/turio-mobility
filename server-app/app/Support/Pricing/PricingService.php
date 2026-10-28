<?php

namespace App\Support\Pricing;

use App\Support\Money;

class PricingService
{
    public function applyFees(float $subtotal, array $context = []): array
    {
        $subtotalMinor = max(0, Money::toMinor($subtotal));
        $taxMinor = (int) round($subtotalMinor * (float) setting('fees.tax_percent', 0.0, $context));
        $serviceFeeMinor = (int) round($subtotalMinor * (float) setting('fees.service_fee_percent', 0.0, $context))
            + Money::toMinor(setting('fees.service_fee_flat', 0.0, $context));

        return [
            'subtotal' => Money::toMajor($subtotalMinor),
            'tax' => Money::toMajor($taxMinor),
            'service_fee' => Money::toMajor($serviceFeeMinor),
            'total' => Money::toMajor($subtotalMinor + $taxMinor + $serviceFeeMinor),
        ];
    }
}

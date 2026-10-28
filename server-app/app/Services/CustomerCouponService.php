<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerCoupon;
use App\Models\CustomerCouponRedemption;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class CustomerCouponService
{
    public const SERVICE_TYPES = ['ride', 'tour', 'rental'];

    public function preview(?Customer $customer, ?string $code, string $serviceType, float $subtotal): array
    {
        $normalizedCode = $this->normalizeCode($code);
        $serviceType = $this->normalizeServiceType($serviceType);
        $subtotal = max(0, round($subtotal, 2));

        if ($normalizedCode === null) {
            return $this->emptyResult($serviceType, $subtotal);
        }

        $coupon = CustomerCoupon::code($normalizedCode)->first();

        if (! $coupon) {
            return $this->ineligible($normalizedCode, $serviceType, $subtotal, 'Coupon code was not found.');
        }

        $eligibilityMessage = $this->eligibilityMessage($coupon, $customer, $serviceType, $subtotal);

        if ($eligibilityMessage !== null) {
            return $this->ineligible($normalizedCode, $serviceType, $subtotal, $eligibilityMessage, $coupon);
        }

        $discount = $this->discountAmount($coupon, $subtotal);

        return [
            'eligible' => $discount > 0,
            'code' => $coupon->code,
            'name' => $coupon->name,
            'description' => $coupon->description,
            'service_type' => $serviceType,
            'subtotal' => $subtotal,
            'discount_amount' => $discount,
            'final_amount' => max(0, round($subtotal - $discount, 2)),
            'message' => $discount > 0 ? "Coupon {$coupon->code} applied." : 'Coupon did not change this total.',
            'coupon' => $coupon,
        ];
    }

    public function availableOffers(Customer $customer, string $serviceType, float $subtotal): array
    {
        return CustomerCoupon::query()
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', now()))
            ->orderByDesc('discount_value')
            ->get()
            ->map(fn (CustomerCoupon $coupon) => $this->preview($customer, $coupon->code, $serviceType, $subtotal))
            ->filter(fn (array $result) => $result['eligible'])
            ->map(fn (array $result) => [
                'code' => $result['code'],
                'name' => $result['name'],
                'description' => $result['description'],
                'discount_amount' => $result['discount_amount'],
                'final_amount' => $result['final_amount'],
                'message' => $result['message'],
            ])
            ->values()
            ->all();
    }

    public function redeem(Customer $customer, CustomerCoupon $coupon, Model $booking, string $serviceType, float $subtotal, float $discount): CustomerCouponRedemption
    {
        return DB::transaction(function () use ($customer, $coupon, $booking, $serviceType, $subtotal, $discount) {
            $lockedCoupon = CustomerCoupon::whereKey($coupon->id)->lockForUpdate()->firstOrFail();
            $preview = $this->preview($customer, $lockedCoupon->code, $serviceType, $subtotal);

            if (! $preview['eligible']) {
                throw new \RuntimeException($preview['message'] ?? 'Coupon can no longer be used.');
            }

            $discount = round(min($discount, (float) $preview['discount_amount']), 2);

            $redemption = CustomerCouponRedemption::create([
                'customer_coupon_id' => $lockedCoupon->id,
                'customer_id' => $customer->id,
                'service_type' => $this->normalizeServiceType($serviceType),
                'redeemable_type' => $booking::class,
                'redeemable_id' => $booking->getKey(),
                'subtotal_amount' => round($subtotal, 2),
                'discount_amount' => $discount,
                'final_amount' => max(0, round($subtotal - $discount, 2)),
                'redeemed_at' => now(),
            ]);

            $lockedCoupon->increment('used_count');

            return $redemption;
        });
    }

    public function normalizeCode(?string $code): ?string
    {
        $code = strtoupper(trim((string) $code));

        return $code === '' ? null : $code;
    }

    private function normalizeServiceType(string $serviceType): string
    {
        $serviceType = strtolower(trim($serviceType));

        if ($serviceType === 'car' || $serviceType === 'car_rental') {
            return 'rental';
        }

        return $serviceType;
    }

    private function eligibilityMessage(CustomerCoupon $coupon, ?Customer $customer, string $serviceType, float $subtotal): ?string
    {
        if (! in_array($serviceType, self::SERVICE_TYPES, true)) {
            return 'Coupon service type is not supported.';
        }

        if (! $coupon->is_active) {
            return 'Coupon is inactive.';
        }

        if ($coupon->starts_at && $coupon->starts_at->isFuture()) {
            return 'Coupon is not active yet.';
        }

        if ($coupon->ends_at && $coupon->ends_at->isPast()) {
            return 'Coupon has expired.';
        }

        $serviceTypes = $coupon->service_types ?: [];
        if ($serviceTypes !== [] && ! in_array($serviceType, $serviceTypes, true)) {
            return 'Coupon is not valid for this service.';
        }

        if ($subtotal < (float) $coupon->min_order_amount) {
            return 'Minimum booking amount for this coupon is ₹'.number_format((float) $coupon->min_order_amount, 2).'.';
        }

        if ($coupon->usage_limit !== null && $coupon->used_count >= $coupon->usage_limit) {
            return 'Coupon usage limit has been reached.';
        }

        if ($customer && $coupon->per_customer_limit > 0) {
            $customerUses = CustomerCouponRedemption::where('customer_coupon_id', $coupon->id)
                ->where('customer_id', $customer->id)
                ->count();

            if ($customerUses >= $coupon->per_customer_limit) {
                return 'You have already used this coupon.';
            }
        }

        return null;
    }

    private function discountAmount(CustomerCoupon $coupon, float $subtotal): float
    {
        $discount = $coupon->discount_type === 'percent'
            ? $subtotal * ((float) $coupon->discount_value / 100)
            : (float) $coupon->discount_value;

        if ($coupon->max_discount_amount !== null) {
            $discount = min($discount, (float) $coupon->max_discount_amount);
        }

        return round(min($subtotal, max(0, $discount)), 2);
    }

    private function emptyResult(string $serviceType, float $subtotal): array
    {
        return [
            'eligible' => false,
            'code' => null,
            'service_type' => $serviceType,
            'subtotal' => $subtotal,
            'discount_amount' => 0.0,
            'final_amount' => $subtotal,
            'message' => 'No coupon code applied.',
            'coupon' => null,
        ];
    }

    private function ineligible(string $code, string $serviceType, float $subtotal, string $message, ?CustomerCoupon $coupon = null): array
    {
        return [
            'eligible' => false,
            'code' => $code,
            'name' => $coupon?->name,
            'description' => $coupon?->description,
            'service_type' => $serviceType,
            'subtotal' => $subtotal,
            'discount_amount' => 0.0,
            'final_amount' => $subtotal,
            'message' => $message,
            'coupon' => $coupon,
        ];
    }
}

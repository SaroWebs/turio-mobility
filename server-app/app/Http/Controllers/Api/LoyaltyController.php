<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomerCoupon;
use App\Models\CustomerLoyaltyPoint;
use App\Models\CustomerReferral;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoyaltyController extends Controller
{
    /**
     * Get loyalty balance and points history for current customer.
     */
    public function index(Request $request): JsonResponse
    {
        $customer = $request->user();
        if (! $customer) {
            return response()->json(['success' => false, 'error' => 'Unauthenticated'], 401);
        }

        $history = CustomerLoyaltyPoint::where('customer_id', $customer->id)
            ->orderBy('created_at', 'desc')
            ->take(50)
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'points' => $item->points,
                'action' => $item->action,
                'reference_type' => $item->reference_type,
                'reference_id' => $item->reference_id,
                'description' => $item->description,
                'created_at' => $item->created_at?->toISOString(),
            ]);

        $totalPoints = (int) CustomerLoyaltyPoint::where('customer_id', $customer->id)->sum('points');
        // ₹1 = 10 points => points in paise is points * 10
        $rupeeValue = (int) floor($totalPoints / 10);

        return response()->json([
            'success' => true,
            'data' => [
                'total_points' => max(0, $totalPoints),
                'rupee_value' => max(0, $rupeeValue),
                'tier' => $totalPoints >= 5000 ? 'Platinum' : ($totalPoints >= 2000 ? 'Gold' : 'Silver'),
                'history' => $history,
            ],
            'meta' => [
                'conversion_rate' => '10 points = ₹1',
            ],
        ]);
    }

    /**
     * Get or create customer referral code and stats.
     */
    public function referralDetails(Request $request): JsonResponse
    {
        $customer = $request->user();
        if (! $customer) {
            return response()->json(['success' => false, 'error' => 'Unauthenticated'], 401);
        }

        // Generate or get existing code based on customer phone/id
        $code = 'SKY'.strtoupper(substr(md5((string) $customer->id.'salt'), 0, 6));

        $referrals = CustomerReferral::where('referrer_customer_id', $customer->id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn ($ref) => [
                'id' => $ref->id,
                'status' => $ref->status,
                'reward_points' => $ref->reward_points,
                'completed_at' => $ref->completed_at?->toISOString(),
                'created_at' => $ref->created_at?->toISOString(),
            ]);

        $totalEarned = (int) CustomerReferral::where('referrer_customer_id', $customer->id)
            ->where('status', 'rewarded')
            ->sum('reward_points');

        return response()->json([
            'success' => true,
            'data' => [
                'referral_code' => $code,
                'referral_url' => url('/').'?ref='.$code,
                'total_referrals' => $referrals->count(),
                'total_earned_points' => $totalEarned,
                'history' => $referrals,
            ],
            'meta' => [
                'reward_per_referral' => 500,
            ],
        ]);
    }

    /**
     * Public deals and featured promotional coupons.
     */
    public function publicDeals(Request $request): JsonResponse
    {
        $deals = CustomerCoupon::where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            })
            ->where(function ($query) {
                $query->where('is_deal', true)->orWhereNotNull('deal_tag');
            })
            ->orderByDesc('created_at')
            ->take(12)
            ->get()
            ->map(fn ($coupon) => [
                'code' => $coupon->code,
                'name' => $coupon->name,
                'description' => $coupon->description,
                'discount_type' => $coupon->discount_type,
                'discount_value' => (float) $coupon->discount_value,
                'max_discount_amount' => $coupon->max_discount_amount ? (float) $coupon->max_discount_amount : null,
                'min_order_amount' => (float) $coupon->min_order_amount,
                'service_types' => $coupon->service_types ?? ['ride', 'tour', 'rental'],
                'deal_tag' => $coupon->deal_tag ?? 'Special Offer',
                'ends_at' => $coupon->ends_at?->toISOString(),
            ]);

        return response()->json([
            'success' => true,
            'data' => $deals,
            'meta' => [
                'count' => $deals->count(),
            ],
        ]);
    }
}

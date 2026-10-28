<?php

namespace App\Http\Controllers;

use App\Models\CustomerCoupon;
use App\Models\CustomerCouponRedemption;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminCouponController extends Controller
{
    public function index(): Response
    {
        $coupons = CustomerCoupon::query()
            ->withCount('redemptions')
            ->withSum('redemptions', 'discount_amount')
            ->latest()
            ->get();

        return Inertia::render('admin/Coupons/Index', [
            'title' => 'Coupons & Offers',
            'coupons' => $coupons,
            'summary' => [
                'total' => $coupons->count(),
                'active' => $coupons->where('is_active', true)->count(),
                'redemptions' => CustomerCouponRedemption::count(),
                'discount_granted' => (float) CustomerCouponRedemption::sum('discount_amount'),
            ],
            'recentRedemptions' => CustomerCouponRedemption::query()
                ->with(['coupon:id,code,name', 'customer:id,name,phone'])
                ->latest('redeemed_at')
                ->limit(25)
                ->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        CustomerCoupon::create($this->validatedData($request));

        return back()->with('success', 'Coupon created successfully.');
    }

    public function update(Request $request, CustomerCoupon $customerCoupon): RedirectResponse
    {
        $customerCoupon->update($this->validatedData($request, $customerCoupon));

        return back()->with('success', 'Coupon updated successfully.');
    }

    public function toggle(CustomerCoupon $customerCoupon): RedirectResponse
    {
        $customerCoupon->update(['is_active' => ! $customerCoupon->is_active]);

        return back()->with('success', $customerCoupon->is_active ? 'Coupon activated.' : 'Coupon paused.');
    }

    private function validatedData(Request $request, ?CustomerCoupon $coupon = null): array
    {
        $request->merge(['code' => strtoupper(trim((string) $request->input('code')))]);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:40', 'alpha_dash', Rule::unique('customer_coupons', 'code')->ignore($coupon?->id)],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'discount_type' => ['required', Rule::in(['fixed', 'percent'])],
            'discount_value' => ['required', 'numeric', 'gt:0'],
            'max_discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'min_order_amount' => ['required', 'numeric', 'gte:0'],
            'service_types' => ['required', 'array', 'min:1'],
            'service_types.*' => ['required', Rule::in(['ride', 'tour', 'rental'])],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'per_customer_limit' => ['required', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['required', 'boolean'],
        ]);

        if ($data['discount_type'] === 'percent' && (float) $data['discount_value'] > 100) {
            throw ValidationException::withMessages(['discount_value' => 'Percentage discount cannot exceed 100%.']);
        }

        foreach (['max_discount_amount', 'usage_limit', 'starts_at', 'ends_at'] as $nullable) {
            $data[$nullable] = $data[$nullable] === '' ? null : $data[$nullable];
        }

        return $data;
    }
}

<?php

use App\Models\CustomerCoupon;
use App\Models\CustomerCouponRedemption;
use App\Models\Role;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function couponAdmin(): User
{
    $admin = User::create([
        'name' => 'Coupon Admin',
        'email' => 'coupon-admin-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    return $admin;
}

it('lets an admin create a customer coupon', function () {
    $this->actingAs(couponAdmin())->post('/admin/coupons', [
        'code' => 'summer25',
        'name' => 'Summer offer',
        'description' => 'Customer promotion',
        'discount_type' => 'percent',
        'discount_value' => 25,
        'max_discount_amount' => 500,
        'min_order_amount' => 1000,
        'service_types' => ['ride', 'tour'],
        'usage_limit' => 100,
        'per_customer_limit' => 2,
        'starts_at' => now()->toDateTimeString(),
        'ends_at' => now()->addMonth()->toDateTimeString(),
        'is_active' => true,
    ])->assertRedirect();

    $coupon = CustomerCoupon::where('code', 'SUMMER25')->firstOrFail();
    expect($coupon->service_types)->toBe(['ride', 'tour'])
        ->and($coupon->per_customer_limit)->toBe(2)
        ->and($coupon->is_active)->toBeTrue();
});

it('validates percentage coupons and requires a service', function () {
    $admin = couponAdmin();
    $payload = [
        'code' => 'TOO-MUCH',
        'name' => 'Invalid offer',
        'discount_type' => 'percent',
        'discount_value' => 101,
        'min_order_amount' => 0,
        'service_types' => ['ride'],
        'per_customer_limit' => 1,
        'is_active' => true,
    ];

    $this->actingAs($admin)->post('/admin/coupons', $payload)
        ->assertSessionHasErrors('discount_value');

    $payload['discount_value'] = 10;
    $payload['service_types'] = [];
    $this->actingAs($admin)->post('/admin/coupons', $payload)
        ->assertSessionHasErrors('service_types');
});

it('lets an admin edit and pause a coupon', function () {
    $coupon = CustomerCoupon::create([
        'code' => 'OLD10', 'name' => 'Old offer', 'discount_type' => 'fixed',
        'discount_value' => 10, 'min_order_amount' => 0, 'service_types' => ['ride'],
        'per_customer_limit' => 1, 'is_active' => true,
    ]);
    $admin = couponAdmin();

    $this->actingAs($admin)->put("/admin/coupons/{$coupon->id}", [
        'code' => 'NEW20', 'name' => 'Updated offer', 'description' => null,
        'discount_type' => 'fixed', 'discount_value' => 20, 'max_discount_amount' => null,
        'min_order_amount' => 50, 'service_types' => ['rental'], 'usage_limit' => null,
        'per_customer_limit' => 1, 'starts_at' => null, 'ends_at' => null, 'is_active' => true,
    ])->assertRedirect();

    $this->actingAs($admin)->patch("/admin/coupons/{$coupon->id}/toggle")->assertRedirect();

    expect($coupon->fresh()->code)->toBe('NEW20')
        ->and($coupon->fresh()->service_types)->toBe(['rental'])
        ->and($coupon->fresh()->is_active)->toBeFalse();
});

it('shows coupon totals on the admin management page', function () {
    CustomerCoupon::create([
        'code' => 'VIEW10', 'name' => 'Visible offer', 'discount_type' => 'fixed',
        'discount_value' => 10, 'min_order_amount' => 0, 'service_types' => ['tour'],
        'per_customer_limit' => 1, 'used_count' => 0, 'is_active' => true,
    ]);

    $this->actingAs(couponAdmin())->get('/admin/coupons')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/Coupons/Index')
            ->where('summary.total', 1)
            ->where('summary.active', 1)
            ->where('summary.redemptions', CustomerCouponRedemption::count())
            ->has('coupons', 1)
            ->has('recentRedemptions'));
});

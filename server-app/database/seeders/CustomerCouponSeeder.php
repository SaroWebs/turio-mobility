<?php

namespace Database\Seeders;

use App\Models\CustomerCoupon;
use Illuminate\Database\Seeder;

class CustomerCouponSeeder extends Seeder
{
    public function run(): void
    {
        $coupons = [
            [
                'code' => 'SKY10',
                'name' => 'Turiya Mobility 10% off',
                'description' => '10% off across tours, rentals, and rides.',
                'discount_type' => 'percent',
                'discount_value' => 10,
                'max_discount_amount' => 750,
                'min_order_amount' => 500,
                'service_types' => ['ride', 'tour', 'rental'],
                'per_customer_limit' => 3,
            ],
            [
                'code' => 'TOUR15',
                'name' => 'Tour explorer offer',
                'description' => '15% off selected tour bookings.',
                'discount_type' => 'percent',
                'discount_value' => 15,
                'max_discount_amount' => 1500,
                'min_order_amount' => 2500,
                'service_types' => ['tour'],
                'per_customer_limit' => 1,
            ],
            [
                'code' => 'RENT500',
                'name' => 'Rental handover credit',
                'description' => 'Flat ₹500 off car rental bookings.',
                'discount_type' => 'fixed',
                'discount_value' => 500,
                'min_order_amount' => 2000,
                'service_types' => ['rental'],
                'per_customer_limit' => 2,
            ],
            [
                'code' => 'RIDE50',
                'name' => 'Ride starter',
                'description' => 'Flat ₹50 off ride bookings.',
                'discount_type' => 'fixed',
                'discount_value' => 50,
                'min_order_amount' => 150,
                'service_types' => ['ride'],
                'per_customer_limit' => 5,
            ],
        ];

        foreach ($coupons as $coupon) {
            CustomerCoupon::updateOrCreate(
                ['code' => $coupon['code']],
                array_merge([
                    'is_active' => true,
                    'usage_limit' => null,
                    'starts_at' => now()->subDay(),
                    'ends_at' => now()->addYear(),
                ], $coupon)
            );
        }
    }
}

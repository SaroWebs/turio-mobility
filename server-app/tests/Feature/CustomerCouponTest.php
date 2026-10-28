<?php

use App\Models\Customer;
use App\Models\CustomerCoupon;
use App\Models\CustomerCouponRedemption;
use App\Models\Tour;
use App\Models\TourSchedule;
use Laravel\Sanctum\Sanctum;

it('previews customer coupon usability and redeems it on a tour booking', function () {
    $customer = Customer::create([
        'name' => 'Coupon Customer',
        'phone' => '9700000001',
        'is_active' => true,
        'phone_verified_at' => now(),
    ]);

    $tour = Tour::create([
        'title' => 'Coupon Tour',
        'slug' => 'coupon-tour',
        'duration_days' => 1,
        'duration_nights' => 0,
        'price_per_person' => 2000,
        'child_price' => 1000,
        'available_from' => now(),
        'available_to' => now()->addMonth(),
        'is_active' => true,
    ]);

    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addWeek()->toDateString(),
        'return_date' => now()->addWeek()->toDateString(),
        'total_seats' => 10,
        'booked_seats' => 0,
        'reserved_seats' => 0,
        'status' => 'open',
    ]);

    $coupon = CustomerCoupon::create([
        'code' => 'SAVE20',
        'name' => 'Save 20',
        'discount_type' => 'percent',
        'discount_value' => 20,
        'max_discount_amount' => 500,
        'min_order_amount' => 1000,
        'service_types' => ['tour'],
        'per_customer_limit' => 1,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
    ]);

    Sanctum::actingAs($customer);

    $this->postJson('/api/customer-app/coupons/preview', [
        'coupon_code' => 'save20',
        'service_type' => 'tour',
        'subtotal' => 4000,
    ])->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.code', 'SAVE20')
        ->assertJsonPath('data.discount_amount', 500);

    $bookingResponse = $this->postJson('/api/customer-app/tours/book', [
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 2,
        'number_of_children' => 0,
        'payment_method' => 'cash',
        'coupon_code' => 'SAVE20',
    ])->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('receipt.coupon_code', 'SAVE20')
        ->assertJsonPath('receipt.discount_amount', 500)
        ->json();

    expect($bookingResponse['receipt']['amount'])->toBe(3500)
        ->and($coupon->fresh()->used_count)->toBe(1)
        ->and(CustomerCouponRedemption::where('customer_coupon_id', $coupon->id)
            ->where('customer_id', $customer->id)
            ->where('service_type', 'tour')
            ->exists())->toBeTrue();

    $this->postJson('/api/customer-app/coupons/preview', [
        'coupon_code' => 'SAVE20',
        'service_type' => 'tour',
        'subtotal' => 4000,
    ])->assertStatus(422)
        ->assertJsonPath('success', false);
});

it('blocks coupons for the wrong customer service type', function () {
    $customer = Customer::create([
        'name' => 'Ride Coupon Customer',
        'phone' => '9700000002',
        'is_active' => true,
        'phone_verified_at' => now(),
    ]);

    CustomerCoupon::create([
        'code' => 'ONLYRIDE',
        'name' => 'Ride only',
        'discount_type' => 'fixed',
        'discount_value' => 50,
        'min_order_amount' => 100,
        'service_types' => ['ride'],
        'per_customer_limit' => 1,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
    ]);

    Sanctum::actingAs($customer);

    $this->postJson('/api/customer-app/coupons/preview', [
        'coupon_code' => 'ONLYRIDE',
        'service_type' => 'rental',
        'subtotal' => 1000,
    ])->assertStatus(422)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Coupon is not valid for this service.');
});

it('lists only coupons currently usable by the signed in customer', function () {
    $customer = Customer::create(['name' => 'Offer Browser', 'phone' => '9100000099']);
    $token = $customer->createToken('customer-web')->plainTextToken;

    CustomerCoupon::create([
        'code' => 'VISIBLE20', 'name' => 'Visible offer', 'discount_type' => 'percent',
        'discount_value' => 20, 'min_order_amount' => 100, 'service_types' => ['tour'],
        'per_customer_limit' => 1, 'is_active' => true,
    ]);
    CustomerCoupon::create([
        'code' => 'HIDDEN20', 'name' => 'Wrong service', 'discount_type' => 'percent',
        'discount_value' => 20, 'min_order_amount' => 100, 'service_types' => ['ride'],
        'per_customer_limit' => 1, 'is_active' => true,
    ]);

    $this->withToken($token)->getJson('/api/customer-app/coupons/available?service_type=tour&subtotal=1000')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.code', 'VISIBLE20')
        ->assertJsonPath('data.0.discount_amount', 200);
});

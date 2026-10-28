<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerCoupon;
use App\Models\CustomerLoyaltyPoint;
use App\Models\Tour;
use App\Models\Wishlist;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WishlistAndLoyaltyTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_fetch_public_deals(): void
    {
        CustomerCoupon::create([
            'code' => 'DEAL2026',
            'name' => 'Summer Escape Deal',
            'discount_type' => 'percentage',
            'discount_value' => 15,
            'min_order_amount' => 1000,
            'is_active' => true,
            'is_deal' => true,
            'deal_tag' => 'Summer Special',
        ]);

        $response = $this->getJson('/api/customer-app/public/coupons/deals');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.code', 'DEAL2026')
            ->assertJsonPath('data.0.deal_tag', 'Summer Special');
    }

    public function test_authenticated_customer_can_toggle_wishlist(): void
    {
        $customer = Customer::create([
            'name' => 'Wishlist Customer',
            'phone' => '9700000002',
            'is_active' => true,
            'phone_verified_at' => now(),
        ]);
        Sanctum::actingAs($customer, ['customer']);

        $tour = Tour::create([
            'title' => 'Scenic Wishlist Tour',
            'slug' => 'scenic-wishlist-tour',
            'duration_days' => 2,
            'duration_nights' => 1,
            'price_per_person' => 3500,
            'available_from' => now(),
            'available_to' => now()->addMonth(),
            'is_active' => true,
        ]);

        // Add to wishlist
        $addResponse = $this->postJson("/api/customer-app/wishlists/tours/{$tour->id}/add");
        $addResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.inWishlist', true);

        $this->assertDatabaseHas('wishlists', [
            'customer_id' => $customer->id,
            'service_type' => 'tour',
            'service_id' => $tour->id,
        ]);

        // Check wishlist
        $checkResponse = $this->postJson("/api/customer-app/wishlists/tours/{$tour->id}/check");
        $checkResponse->assertStatus(200)
            ->assertJsonPath('data.inWishlist', true);

        // List wishlist
        $listResponse = $this->getJson('/api/customer-app/wishlists');
        $listResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.tours.0.id', (string) $tour->id);

        // Remove from wishlist
        $removeResponse = $this->postJson("/api/customer-app/wishlists/tours/{$tour->id}/remove");
        $removeResponse->assertStatus(200)
            ->assertJsonPath('data.inWishlist', false);

        $this->assertDatabaseMissing('wishlists', [
            'customer_id' => $customer->id,
            'service_type' => 'tour',
            'service_id' => $tour->id,
        ]);
    }

    public function test_authenticated_customer_can_view_loyalty_and_referrals(): void
    {
        $customer = Customer::create([
            'name' => 'Loyalty Customer',
            'phone' => '9700000003',
            'is_active' => true,
            'phone_verified_at' => now(),
        ]);
        Sanctum::actingAs($customer, ['customer']);

        CustomerLoyaltyPoint::create([
            'customer_id' => $customer->id,
            'points' => 200,
            'action' => 'welcome_bonus',
            'description' => 'Welcome reward points',
        ]);

        $loyaltyResponse = $this->getJson('/api/customer-app/loyalty');
        $loyaltyResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_points', 200)
            ->assertJsonPath('data.rupee_value', 20);

        $referralResponse = $this->getJson('/api/customer-app/referrals');
        $referralResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'referral_code',
                    'referral_url',
                    'total_referrals',
                    'total_earned_points',
                    'history',
                ],
            ]);
    }
}

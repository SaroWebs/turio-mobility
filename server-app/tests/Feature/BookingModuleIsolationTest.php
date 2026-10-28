<?php

use App\Models\Customer;
use Laravel\Sanctum\Sanctum;

it('rejects fields from another booking module instead of silently mixing flows', function () {
    $customer = Customer::create([
        'name' => 'Flow Boundary Customer',
        'phone' => '9000000301',
        'email' => 'flow-boundary@example.com',
        'is_active' => true,
    ]);

    Sanctum::actingAs($customer);

    $this->postJson('/api/customer-app/rides/estimate', [
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_lat' => 12.9352,
        'dropoff_lng' => 77.6245,
        'service_type' => 'point_to_point',
        'scheduled_at' => now()->addDay()->toISOString(),
        'tour_schedule_id' => 99,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('tour_schedule_id');

    $this->postJson('/api/customer-app/tours/book', [
        'tour_id' => 99,
        'tour_schedule_id' => 99,
        'number_of_adults' => 1,
        'payment_method' => 'cash',
        'sharing_requested' => true,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('sharing_requested');

    $this->postJson('/api/customer-app/car-rentals', [
        'car_category_id' => 99,
        'start_date' => now()->addDays(2)->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
        'pickup_location' => 'Airport',
        'sharing_requested' => true,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('sharing_requested');
});

it('does not expose the former generic writable booking workflow routes', function () {
    $customer = Customer::create([
        'name' => 'Explicit Route Customer',
        'phone' => '9000000302',
        'is_active' => true,
    ]);

    Sanctum::actingAs($customer);

    $this->getJson('/api/customer-app/bookings/ride/1/next-steps')->assertNotFound();
    $this->postJson('/api/customer-app/bookings/tour/1/check-in')->assertNotFound();
});

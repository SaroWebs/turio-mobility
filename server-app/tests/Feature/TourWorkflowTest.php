<?php

use App\Models\Customer;
use App\Models\Place;
use App\Models\Role;
use App\Models\Tour;
use App\Models\TourCategory;
use App\Models\TourSchedule;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

it('creates a tour first and derives duration from sequential itinerary days', function () {
    $admin = User::create(['name' => 'Tour Admin', 'email' => 'tour-admin@example.com', 'password' => 'password']);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);
    $category = TourCategory::create(['name' => 'Nature', 'slug' => 'nature', 'is_active' => true]);
    $firstPlace = Place::create(['name' => 'Living Root Bridge', 'slug' => 'living-root-bridge', 'is_active' => true]);
    $secondPlace = Place::create(['name' => 'Shillong Peak', 'slug' => 'shillong-peak', 'is_active' => true]);

    $this->actingAs($admin)->post('/admin/tours', [
        'tour_category_id' => $category->id,
        'title' => 'Meghalaya Living Roots',
        'short_description' => 'A guided rainforest and living-root bridge experience.',
        'description' => 'A complete three day tour with local transport and guided destination experiences.',
        'highlights' => ['Living root bridge', 'Local village walk'],
        'inclusions' => ['Transport', 'Breakfast'],
        'exclusions' => ['Flights'],
        'cancellation_policy' => 'Free date change until seven days before departure.',
        'min_group_size' => 2, 'max_group_size' => 6,
        'price_per_person' => 12500, 'child_price' => 8500, 'discount' => 10,
        'start_location' => 'Shillong', 'end_location' => 'Shillong', 'region' => 'Meghalaya', 'difficulty' => 'moderate',
        'available_from' => now()->toDateString(), 'available_to' => now()->addMonths(3)->toDateString(),
        'is_active' => true, 'is_featured' => true,
    ])->assertRedirect();

    $tour = Tour::where('title', 'Meghalaya Living Roots')->firstOrFail();
    expect($tour->slug)->toBe('meghalaya-living-roots')
        ->and((float) $tour->price_per_person)->toBe(12500.0)
        ->and($tour->duration_days)->toBe(0)
        ->and($tour->itineraries)->toHaveCount(0);

    foreach ([[$firstPlace, 1, '09:00'], [$secondPlace, 1, '14:00'], [$firstPlace, 2, '10:00']] as $index => [$place, $day, $time]) {
        $this->actingAs($admin)->post("/admin/tours/{$tour->id}/itineraries", [
            'place_id' => $place->id,
            'day_number' => $day,
            'time' => $time,
            'title' => $place->name,
            'start_location' => $index === 0 ? 'Shillong' : 'Village stop',
            'end_location' => $place->name,
            'details' => 'Plan for visit '.($index + 1),
            'activities' => ['Guided visit'],
            'meals_included' => ['breakfast'],
            'distance_km' => '85',
            'travel_time' => '3-4 hours',
            'key_stops' => [['name' => $place->name, 'description' => 'A planned experience stop.']],
            'inclusions' => ['Transport', 'Breakfast'],
            'exclusions' => ['Lunch'],
        ])->assertRedirect();
    }

    expect($tour->fresh()->duration_days)->toBe(2)
        ->and($tour->fresh()->duration_nights)->toBe(1)
        ->and($tour->itineraries()->pluck('day_number')->all())->toBe([1, 1, 2])
        ->and($tour->itineraries()->pluck('stop_order')->all())->toBe([1, 2, 1]);

    $this->getJson("/api/customer-app/public/tours/{$tour->id}")
        ->assertOk()
        ->assertJsonPath('data.itineraries.0.day_number', 1)
        ->assertJsonPath('data.itineraries.0.stop_order', 1)
        ->assertJsonPath('data.itineraries.1.day_number', 1)
        ->assertJsonPath('data.itineraries.1.stop_order', 2)
        ->assertJsonPath('data.itineraries.2.day_number', 2)
        ->assertJsonPath('data.cancellation_policy', 'Free date change until seven days before departure.')
        ->assertJsonPath('data.inclusions.0', 'Transport')
        ->assertJsonPath('data.itineraries.0.start_location', 'Shillong')
        ->assertJsonPath('data.itineraries.0.travel_time', '3-4 hours')
        ->assertJsonPath('data.itineraries.0.key_stops.0.name', 'Living Root Bridge')
        ->assertJsonPath('data.itineraries.0.inclusions.0', 'Transport')
        ->assertJsonPath('data.itineraries.0.exclusions.0', 'Lunch');

    $this->actingAs($admin)->delete("/admin/tours/{$tour->id}/itineraries/{$tour->itineraries()->first()->id}")->assertRedirect();
    expect($tour->fresh()->duration_days)->toBe(2)
        ->and($tour->itineraries()->where('day_number', 1)->first()->stop_order)->toBe(1);

    $this->actingAs($admin)->delete("/admin/tours/{$tour->id}/itineraries/{$tour->itineraries()->where('day_number', 1)->first()->id}")->assertRedirect();
    expect($tour->fresh()->duration_days)->toBe(1)
        ->and($tour->fresh()->duration_nights)->toBe(0)
        ->and($tour->itineraries()->first()->day_number)->toBe(1);
});

it('rejects booking a departure that belongs to a different tour', function () {
    $customer = Customer::create(['name' => 'Tour Customer', 'phone' => '9000000042']);
    $first = Tour::create([
        'title' => 'First Tour', 'slug' => 'first-tour', 'price_per_person' => 1000, 'child_price' => 500,
        'available_from' => now(), 'available_to' => now()->addMonth(), 'is_active' => true,
    ]);
    $second = Tour::create([
        'title' => 'Second Tour', 'slug' => 'second-tour', 'price_per_person' => 2000, 'child_price' => 1000,
        'available_from' => now(), 'available_to' => now()->addMonth(), 'is_active' => true,
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $second->id, 'departure_date' => now()->addWeek(), 'return_date' => now()->addDays(8),
        'total_seats' => 5, 'status' => 'open',
    ]);
    Sanctum::actingAs($customer);

    $this->postJson('/api/customer-app/tours/book', [
        'tour_id' => $first->id, 'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 1, 'number_of_children' => 0, 'payment_method' => 'cash',
    ])->assertStatus(422)->assertJsonPath('message', 'The selected departure does not belong to this tour.');

    $this->assertDatabaseCount('tour_bookings', 0);
    expect($schedule->fresh()->reserved_seats)->toBe(0);
});

it('completes the customer booking and cancellation cycle while keeping seat inventory correct', function () {
    $customer = Customer::create(['name' => 'Cycle Customer', 'phone' => '9000000043']);
    $tour = Tour::create([
        'title' => 'Cycle Tour', 'slug' => 'cycle-tour', 'price_per_person' => 2000, 'child_price' => 1000,
        'available_from' => now(), 'available_to' => now()->addMonth(), 'is_active' => true,
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id, 'departure_date' => now()->addWeek(), 'return_date' => now()->addDays(8),
        'total_seats' => 6, 'status' => 'open',
    ]);
    TourSchedule::create([
        'tour_id' => $tour->id, 'departure_date' => now()->addDays(2), 'return_date' => now()->addDays(3),
        'total_seats' => 2, 'booked_seats' => 2, 'status' => 'open',
    ]);
    Sanctum::actingAs($customer);

    $this->getJson("/api/customer-app/public/tours/{$tour->id}")
        ->assertOk()
        ->assertJsonPath('data.schedules.0.id', $schedule->id);
    $this->getJson("/api/customer-app/public/tours/{$tour->id}/schedules")
        ->assertOk()
        ->assertJsonPath('data.0.id', $schedule->id);

    $response = $this->postJson('/api/customer-app/tours/book', [
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 2,
        'number_of_children' => 1,
        'payment_method' => 'cash',
        'pickup_option' => 'Hotel pickup',
    ])->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('receipt.service_type', 'tour')
        ->assertJsonPath('receipt.amount', 5000);

    $bookingId = $response->json('data.id');
    expect($schedule->fresh()->reserved_seats)->toBe(3)
        ->and($schedule->fresh()->booked_seats)->toBe(0);

    $this->getJson("/api/customer-app/tour-bookings/{$bookingId}/next-steps")
        ->assertOk()
        ->assertJsonPath('data.service_type', 'tour')
        ->assertJsonPath('data.actions.can_check_in', false); // Cash booking is still pending confirmation.

    $this->postJson("/api/customer-app/tour-bookings/{$bookingId}/cancel", [
        'reason' => 'Plans changed',
    ])->assertOk()
        ->assertJsonPath('data.booking.status', 'cancelled');

    expect($schedule->fresh()->reserved_seats)->toBe(0)
        ->and($schedule->fresh()->booked_seats)->toBe(0);
});

it('rejects an open departure whose date has already passed', function () {
    $customer = Customer::create(['name' => 'Past Tour Customer', 'phone' => '9000000044']);
    $tour = Tour::create([
        'title' => 'Past Tour', 'slug' => 'past-tour', 'price_per_person' => 1000, 'child_price' => 500,
        'available_from' => now()->subMonth(), 'available_to' => now()->addMonth(), 'is_active' => true,
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id, 'departure_date' => now()->subDay(), 'return_date' => now(),
        'total_seats' => 5, 'status' => 'open',
    ]);
    Sanctum::actingAs($customer);

    $this->postJson('/api/customer-app/tours/book', [
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 1,
        'number_of_children' => 0,
        'payment_method' => 'cash',
    ])->assertStatus(422)
        ->assertJsonPath('message', 'This departure has already left. Select a future departure.');

    $this->assertDatabaseCount('tour_bookings', 0);
    expect($schedule->fresh()->reserved_seats)->toBe(0);
});

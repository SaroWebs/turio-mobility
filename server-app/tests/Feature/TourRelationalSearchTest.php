<?php

use App\Models\Place;
use App\Models\Tour;
use App\Models\TourSchedule;

function relationalSearchTour(string $title, int $days = 2, int $seats = 10, array $attributes = [], array $departure = []): Tour
{
    $tour = Tour::create(['title' => $title, 'slug' => \Illuminate\Support\Str::slug($title), 'price_per_person' => 2000, 'is_active' => true, ...$attributes]);
    TourSchedule::create(['tour_id' => $tour->id, 'departure_date' => now()->addDays($days), 'departure_time' => '09:00:00', 'return_date' => now()->addDays($days + 1), 'total_seats' => $seats, 'status' => 'open', ...$departure]);

    return $tour;
}

it('filters destinations by itinerary foreign keys and never by a matching title', function () {
    $place = Place::create(['name' => 'Hidden Falls', 'slug' => 'hidden-falls', 'is_active' => true]);
    $linked = relationalSearchTour('Forest expedition');
    $linked->itineraries()->create(['place_id' => $place->id, 'day_number' => 1, 'title' => 'Waterfall stop']);
    $linked->itineraries()->create(['place_id' => $place->id, 'day_number' => 2, 'title' => 'Return visit']);
    relationalSearchTour('Hidden Falls name only');

    $this->getJson('/api/customer-app/public/tours?destination_id='.$place->id.'&page=1&per_page=1')
        ->assertOk()->assertJsonPath('pagination.total', 1)->assertJsonPath('data.0.id', $linked->id);
    $this->getJson('/api/customer-app/public/tours?q=Hidden%20Falls&page=1')
        ->assertOk()->assertJsonPath('pagination.total', 2);
    $this->getJson('/api/customer-app/public/tours?destination_id='.$place->id.'&q=unrelated&page=1')
        ->assertOk()->assertJsonPath('pagination.total', 0);
});

it('orders paginated results by departure then remaining seats excluding unavailable departures', function () {
    $few = relationalSearchTour('Few seats', 2, 10, [], ['booked_seats' => 5, 'reserved_seats' => 3]);
    $many = relationalSearchTour('Many seats', 2, 8);
    $later = relationalSearchTour('Later departure', 3, 20);
    relationalSearchTour('Sold out', 1, 2, [], ['reserved_seats' => 2]);
    relationalSearchTour('Past departure', -2);
    relationalSearchTour('Closed departure', 1, 10, [], ['status' => 'cancelled']);

    $this->getJson('/api/customer-app/public/tours?sort=departure&page=1&per_page=1')->assertOk()
        ->assertJsonPath('pagination.total', 3)->assertJsonPath('data.0.id', $many->id);
    $this->getJson('/api/customer-app/public/tours?sort=departure&page=2&per_page=1')->assertOk()
        ->assertJsonPath('data.0.id', $few->id)->assertJsonPath('data.0.available_seats', 2);
    $this->getJson('/api/customer-app/public/tours?sort=availability&page=1&per_page=1')->assertOk()
        ->assertJsonPath('data.0.id', $later->id);
});

it('applies price and duration filters before pagination using the displayed departure price', function () {
    relationalSearchTour('Cheap base expensive departure', 1, 10, ['duration_days' => 2], ['price_override' => 18000]);
    $match = relationalSearchTour('Discounted departure', 2, 10, ['price_per_person' => 16000, 'duration_days' => 3], ['price_override' => 4500]);
    relationalSearchTour('Long trip', 2, 10, ['duration_days' => 5]);

    $this->getJson('/api/customer-app/public/tours?price_range=under_5k&duration=2_3_days&page=1&per_page=1')->assertOk()
        ->assertJsonPath('pagination.total', 1)->assertJsonPath('data.0.id', $match->id)
        ->assertJsonPath('data.0.price_per_person', 4500);
    $this->getJson('/api/customer-app/public/tours?min_rating=4.5&page=1')->assertOk()->assertJsonPath('pagination.total', 0);
    $customer = \App\Models\Customer::create(['name' => 'Reviewer', 'phone' => '9876543299']);
    $booking = \App\Models\TourBooking::create([
        'customer_id' => $customer->id, 'tour_id' => $match->id, 'tour_schedule_id' => $match->schedules()->first()->id,
        'travel_date' => now()->addDays(2), 'number_of_adults' => 1, 'customer_name' => 'Reviewer',
        'customer_phone' => $customer->phone, 'price_per_adult' => 4500, 'subtotal' => 4500,
        'total_price' => 4500, 'status' => 'completed', 'payment_status' => 'paid',
    ]);
    \App\Models\TourBookingReview::create(['tour_booking_id' => $booking->id, 'customer_id' => $customer->id, 'tour_rating' => 5]);
    $this->getJson('/api/customer-app/public/tours?min_rating=4.5&page=1')->assertOk()
        ->assertJsonPath('pagination.total', 1)->assertJsonPath('data.0.id', $match->id)->assertJsonPath('data.0.rating', 5);
    $this->getJson('/api/customer-app/public/tours?destination_id=99999')->assertUnprocessable();
});

it('filters by persisted tour difficulty and ignores the removed travel style parameter', function () {
    $easy = relationalSearchTour('Easy walk', 2, 10, ['difficulty' => 'easy']);
    relationalSearchTour('Challenging hike', 2, 10, ['difficulty' => 'challenging']);

    $this->getJson('/api/customer-app/public/tours?difficulty=easy&page=1')
        ->assertOk()->assertJsonPath('pagination.total', 1)->assertJsonPath('data.0.id', $easy->id);

    $this->getJson('/api/customer-app/public/tours?travel_style=multi-generational&page=1')
        ->assertOk()->assertJsonPath('pagination.total', 2);

    $this->getJson('/api/customer-app/public/tours?difficulty=multi-generational')
        ->assertUnprocessable();
});

it('keeps legacy cursor ordering consistent when same-date departures have different seat counts', function () {
    $first = relationalSearchTour('First ID fewer seats', 2, 2);
    $second = relationalSearchTour('Second ID more seats', 2, 20);
    $page = $this->getJson('/api/customer-app/public/tours?pagination=cursor&per_page=1')->assertOk();
    $page->assertJsonPath('data.0.id', $first->id);
    $this->getJson('/api/customer-app/public/tours?per_page=1&cursor='.urlencode($page->json('pagination.next_cursor')))
        ->assertOk()->assertJsonPath('data.0.id', $second->id);
});

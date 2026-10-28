<?php

use App\Models\Customer;
use App\Models\Setting;
use App\Models\Tour;
use App\Models\TourCategory;
use App\Models\TourSchedule;
use App\Support\Settings\SettingsService;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

it('performs keyset cursor pagination with deterministic departure and tour id ordering', function () {
    $category = TourCategory::create(['name' => 'Adventure', 'slug' => 'adventure', 'is_active' => true]);

    $tours = [];
    for ($i = 1; $i <= 5; $i++) {
        $tour = Tour::create([
            'tour_category_id' => $category->id,
            'title' => "Tour {$i}",
            'slug' => "tour-{$i}",
            'price_per_person' => 100 * $i,
            'is_active' => true,
            'start_location' => 'Guwahati',
        ]);
        // Each tour departs on consecutive days
        TourSchedule::create([
            'tour_id' => $tour->id,
            'departure_date' => now()->addDays($i)->toDateString(),
            'departure_time' => '09:00:00',
            'return_date' => now()->addDays($i + 2)->toDateString(),
            'total_seats' => 10,
            'booked_seats' => 0,
            'reserved_seats' => 0,
            'status' => 'open',
        ]);
        $tours[] = $tour;
    }

    // Page 1: per_page = 2
    $page1Response = $this->getJson('/api/customer-app/public/tours?pagination=cursor&per_page=2')->assertOk();
    $page1Data = $page1Response->json('data');
    $page1Pagination = $page1Response->json('pagination');

    expect($page1Data)->toHaveCount(2)
        ->and($page1Data[0]['id'])->toBe($tours[0]->id)
        ->and($page1Data[1]['id'])->toBe($tours[1]->id)
        ->and($page1Pagination['has_more'])->toBeTrue()
        ->and($page1Pagination['next_cursor'])->not->toBeNull();

    // Page 2: pass cursor
    $cursor1 = $page1Pagination['next_cursor'];
    $page2Response = $this->getJson("/api/customer-app/public/tours?cursor={$cursor1}&per_page=2")->assertOk();
    $page2Data = $page2Response->json('data');
    $page2Pagination = $page2Response->json('pagination');

    expect($page2Data)->toHaveCount(2)
        ->and($page2Data[0]['id'])->toBe($tours[2]->id)
        ->and($page2Data[1]['id'])->toBe($tours[3]->id)
        ->and($page2Pagination['has_more'])->toBeTrue()
        ->and($page2Pagination['next_cursor'])->not->toBeNull();

    // Page 3: pass cursor
    $cursor2 = $page2Pagination['next_cursor'];
    $page3Response = $this->getJson("/api/customer-app/public/tours?cursor={$cursor2}&per_page=2")->assertOk();
    $page3Data = $page3Response->json('data');
    $page3Pagination = $page3Response->json('pagination');

    expect($page3Data)->toHaveCount(1)
        ->and($page3Data[0]['id'])->toBe($tours[4]->id)
        ->and($page3Pagination['has_more'])->toBeFalse()
        ->and($page3Pagination['next_cursor'])->toBeNull();
});

it('maintains pagination stability under concurrent inventory mutation where offset pagination skips items', function () {
    $category = TourCategory::create(['name' => 'Safari', 'slug' => 'safari', 'is_active' => true]);

    $tours = [];
    for ($i = 1; $i <= 4; $i++) {
        $tour = Tour::create([
            'tour_category_id' => $category->id,
            'title' => "Safari Tour {$i}",
            'slug' => "safari-tour-{$i}",
            'price_per_person' => 200,
            'is_active' => true,
            'start_location' => 'Kaziranga',
        ]);
        TourSchedule::create([
            'tour_id' => $tour->id,
            'departure_date' => now()->addDays($i)->toDateString(),
            'departure_time' => '10:00:00',
            'return_date' => now()->addDays($i + 1)->toDateString(),
            'total_seats' => 5,
            'booked_seats' => 0,
            'reserved_seats' => 0,
            'status' => 'open',
        ]);
        $tours[] = $tour;
    }

    // Client requests Page 1 with cursor
    $page1CursorResponse = $this->getJson('/api/customer-app/public/tours?pagination=cursor&per_page=2')->assertOk();
    $page1Cursor = $page1CursorResponse->json('pagination.next_cursor');

    // CONCURRENT MUTATION: Tour 1 sells out completely
    $schedule1 = $tours[0]->schedules()->first();
    $schedule1->update(['booked_seats' => 5]); // 0 available seats remaining

    // OFFSET PAGINATION FAILURE DEMONSTRATION:
    // With offset pagination (page=2, per_page=2 -> OFFSET 2):
    // Active remaining tours are [Tour 2, Tour 3, Tour 4].
    // OFFSET 2 skips Tour 2 AND Tour 3, jumping straight to Tour 4! Tour 3 was completely missed!
    $offsetPage2 = $this->getJson('/api/customer-app/public/tours?page=2&per_page=2')->assertOk()->json('data');
    expect($offsetPage2)->toHaveCount(1)
        ->and($offsetPage2[0]['id'])->toBe($tours[3]->id); // Tour 3 was skipped by offset pagination!

    // KEYSET CURSOR PAGINATION PRESERVATION:
    // With cursor pagination from the end of Page 1 (Tour 2), it seeks strictly after Tour 2.
    // Result contains Tour 3 and Tour 4! Tour 3 is safely preserved!
    $cursorPage2 = $this->getJson("/api/customer-app/public/tours?cursor={$page1Cursor}&per_page=2")->assertOk()->json('data');
    expect($cursorPage2)->toHaveCount(2)
        ->and($cursorPage2[0]['id'])->toBe($tours[2]->id) // Tour 3 is NOT lost!
        ->and($cursorPage2[1]['id'])->toBe($tours[3]->id);
});

it('orders departures by instant rather than date alone', function () {
    $category = TourCategory::create(['name' => 'Cultural', 'slug' => 'cultural', 'is_active' => true]);

    $afternoonTour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Afternoon Tour',
        'slug' => 'afternoon-tour',
        'price_per_person' => 150,
        'is_active' => true,
        'start_location' => 'Shillong',
    ]);
    TourSchedule::create([
        'tour_id' => $afternoonTour->id,
        'departure_date' => now()->addDays(3)->toDateString(),
        'departure_time' => '16:00:00',
        'return_date' => now()->addDays(4)->toDateString(),
        'total_seats' => 10,
        'status' => 'open',
    ]);

    $morningTour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Morning Tour',
        'slug' => 'morning-tour',
        'price_per_person' => 150,
        'is_active' => true,
        'start_location' => 'Shillong',
    ]);
    TourSchedule::create([
        'tour_id' => $morningTour->id,
        'departure_date' => now()->addDays(3)->toDateString(),
        'departure_time' => '07:00:00',
        'return_date' => now()->addDays(4)->toDateString(),
        'total_seats' => 10,
        'status' => 'open',
    ]);

    $results = $this->getJson('/api/customer-app/public/tours')->assertOk()->json('data');
    expect($results)->toHaveCount(2)
        ->and($results[0]['id'])->toBe($morningTour->id)
        ->and($results[1]['id'])->toBe($afternoonTour->id);
});

it('reconciles group size rules between search, quote, and booking', function () {
    Cache::forget(SettingsService::CACHE_KEY);
    Setting::create(['key' => 'tour.enforce_group_size', 'value' => true]);
    Cache::forget(SettingsService::CACHE_KEY);

    $category = TourCategory::create(['name' => 'Trekking', 'slug' => 'trekking', 'is_active' => true]);

    $soloTour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Solo Backpacking',
        'slug' => 'solo-backpacking',
        'min_group_size' => 1,
        'max_group_size' => 2,
        'price_per_person' => 500,
        'is_active' => true,
        'start_location' => 'Cherrapunji',
    ]);
    $soloSched = TourSchedule::create([
        'tour_id' => $soloTour->id,
        'departure_date' => now()->addDays(5)->toDateString(),
        'departure_time' => '08:00:00',
        'return_date' => now()->addDays(6)->toDateString(),
        'total_seats' => 10,
        'status' => 'open',
    ]);

    $groupTour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Large Group Expedition',
        'slug' => 'large-group-expedition',
        'min_group_size' => 4,
        'max_group_size' => 15,
        'price_per_person' => 300,
        'is_active' => true,
        'start_location' => 'Cherrapunji',
    ]);
    $groupSched = TourSchedule::create([
        'tour_id' => $groupTour->id,
        'departure_date' => now()->addDays(5)->toDateString(),
        'departure_time' => '09:00:00',
        'return_date' => now()->addDays(7)->toDateString(),
        'total_seats' => 20,
        'status' => 'open',
    ]);

    // Search with guests = 1: should return Solo tour, not Group tour
    $search1 = $this->getJson('/api/customer-app/public/tours?guests=1')->assertOk()->json('data');
    expect(collect($search1)->pluck('id')->all())->toContain($soloTour->id)
        ->and(collect($search1)->pluck('id')->all())->not->toContain($groupTour->id);

    // Search with guests = 4: should return Group tour, not Solo tour
    $search4 = $this->getJson('/api/customer-app/public/tours?guests=4')->assertOk()->json('data');
    expect(collect($search4)->pluck('id')->all())->toContain($groupTour->id)
        ->and(collect($search4)->pluck('id')->all())->not->toContain($soloTour->id);

    // Attempt booking Solo tour with 4 adults: should be rejected
    $customer = Customer::create(['name' => 'Traveller', 'phone' => '9876543210']);
    Sanctum::actingAs($customer);

    $bookingResponse = $this->postJson('/api/customer-app/tours/book', [
        'tour_id' => $soloTour->id,
        'tour_schedule_id' => $soloSched->id,
        'number_of_adults' => 4,
        'payment_method' => 'cash',
    ]);
    $bookingResponse->assertStatus(422)
        ->assertJsonPath('message', 'The requested group size is outside this tour\'s limits or the tour is not currently bookable.');

    // Booking Group tour with 4 adults: succeeds
    $validBookingResponse = $this->postJson('/api/customer-app/tours/book', [
        'tour_id' => $groupTour->id,
        'tour_schedule_id' => $groupSched->id,
        'number_of_adults' => 4,
        'payment_method' => 'cash',
    ]);
    $validBookingResponse->assertCreated();
});

it('preserves backwards compatibility for offset pagination and unpaginated discovery', function () {
    $category = TourCategory::create(['name' => 'Nature', 'slug' => 'nature', 'is_active' => true]);

    for ($i = 1; $i <= 3; $i++) {
        $tour = Tour::create([
            'tour_category_id' => $category->id,
            'title' => "Nature Tour {$i}",
            'slug' => "nature-tour-{$i}",
            'price_per_person' => 100,
            'is_active' => true,
            'start_location' => 'Tezpur',
        ]);
        TourSchedule::create([
            'tour_id' => $tour->id,
            'departure_date' => now()->addDays($i)->toDateString(),
            'departure_time' => '10:00:00',
            'return_date' => now()->addDays($i + 1)->toDateString(),
            'total_seats' => 5,
            'status' => 'open',
        ]);
    }

    // Offset pagination returns current_page, last_page, total
    $offsetRes = $this->getJson('/api/customer-app/public/tours?page=1&per_page=2')->assertOk();
    $offsetRes->assertJsonStructure([
        'success',
        'data',
        'pagination' => ['current_page', 'last_page', 'total'],
    ]);
    expect($offsetRes->json('pagination.total'))->toBe(3)
        ->and($offsetRes->json('pagination.last_page'))->toBe(2);

    // Unpaginated returns all data without pagination key
    $unpaginatedRes = $this->getJson('/api/customer-app/public/tours')->assertOk();
    expect($unpaginatedRes->json('pagination'))->toBeNull()
        ->and($unpaginatedRes->json('data'))->toHaveCount(3);
});

it('orders tours by date and availability by default', function () {
    $category = TourCategory::create(['name' => 'Culture', 'slug' => 'culture', 'is_active' => true]);

    // Tour A: departs in 3 days with 5 seats
    $tourA = Tour::create(['tour_category_id' => $category->id, 'title' => 'Tour Later', 'slug' => 'tour-later', 'price_per_person' => 100, 'is_active' => true]);
    TourSchedule::create(['tour_id' => $tourA->id, 'departure_date' => now()->addDays(3)->toDateString(), 'departure_time' => '09:00:00', 'return_date' => now()->addDays(4)->toDateString(), 'total_seats' => 5, 'booked_seats' => 0, 'reserved_seats' => 0, 'status' => 'open']);

    // Tour B: departs in 2 days with 2 available seats
    $tourB = Tour::create(['tour_category_id' => $category->id, 'title' => 'Tour Soon Few Seats', 'slug' => 'tour-soon-few', 'price_per_person' => 100, 'is_active' => true]);
    TourSchedule::create(['tour_id' => $tourB->id, 'departure_date' => now()->addDays(2)->toDateString(), 'departure_time' => '09:00:00', 'return_date' => now()->addDays(3)->toDateString(), 'total_seats' => 10, 'booked_seats' => 8, 'reserved_seats' => 0, 'status' => 'open']);

    // Tour C: departs in 2 days with 8 available seats (same date as B, but more available seats)
    $tourC = Tour::create(['tour_category_id' => $category->id, 'title' => 'Tour Soon Many Seats', 'slug' => 'tour-soon-many', 'price_per_person' => 100, 'is_active' => true]);
    TourSchedule::create(['tour_id' => $tourC->id, 'departure_date' => now()->addDays(2)->toDateString(), 'departure_time' => '09:00:00', 'return_date' => now()->addDays(3)->toDateString(), 'total_seats' => 10, 'booked_seats' => 2, 'reserved_seats' => 0, 'status' => 'open']);

    $response = $this->getJson('/api/customer-app/public/tours?page=1&per_page=10')->assertOk();
    $data = $response->json('data');

    // First two must be departure in 2 days, with Tour C (8 seats) before Tour B (2 seats)
    $ids = collect($data)->pluck('id')->all();
    $indexC = array_search($tourC->id, $ids);
    $indexB = array_search($tourB->id, $ids);
    $indexA = array_search($tourA->id, $ids);

    expect($indexC)->toBeLessThan($indexB)
        ->and($indexB)->toBeLessThan($indexA);
});

it('filters tours by relational destination_id via itineraries', function () {
    $category = TourCategory::create(['name' => 'Sightseeing', 'slug' => 'sightseeing', 'is_active' => true]);
    $place = \App\Models\Place::create(['name' => 'Kamakhya Temple', 'slug' => 'kamakhya-temple', 'city' => 'Guwahati', 'is_active' => true]);
    $otherPlace = \App\Models\Place::create(['name' => 'Umananda Island', 'slug' => 'umananda-island', 'city' => 'Guwahati', 'is_active' => true]);

    $tourMatch = Tour::create(['tour_category_id' => $category->id, 'title' => 'Guwahati Spiritual Tour', 'slug' => 'guwahati-spiritual', 'price_per_person' => 100, 'is_active' => true]);
    TourSchedule::create(['tour_id' => $tourMatch->id, 'departure_date' => now()->addDays(2)->toDateString(), 'departure_time' => '09:00:00', 'return_date' => now()->addDays(3)->toDateString(), 'total_seats' => 10, 'status' => 'open']);
    \App\Models\TourItinerary::create(['tour_id' => $tourMatch->id, 'place_id' => $place->id, 'day_number' => 1, 'stop_order' => 1, 'title' => 'Visit Temple']);

    $tourOther = Tour::create(['tour_category_id' => $category->id, 'title' => 'River Island Tour', 'slug' => 'river-island', 'price_per_person' => 100, 'is_active' => true]);
    TourSchedule::create(['tour_id' => $tourOther->id, 'departure_date' => now()->addDays(2)->toDateString(), 'departure_time' => '09:00:00', 'return_date' => now()->addDays(3)->toDateString(), 'total_seats' => 10, 'status' => 'open']);
    \App\Models\TourItinerary::create(['tour_id' => $tourOther->id, 'place_id' => $otherPlace->id, 'day_number' => 1, 'stop_order' => 1, 'title' => 'Visit Island']);

    $response = $this->getJson("/api/customer-app/public/tours?destination_id={$place->id}")->assertOk();
    $ids = collect($response->json('data'))->pluck('id')->all();

    expect($ids)->toContain($tourMatch->id)
        ->and($ids)->not->toContain($tourOther->id);
});

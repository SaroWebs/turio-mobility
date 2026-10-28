<?php

use App\Events\NewRideRequest;
use App\Models\BookingAuditLog;
use App\Models\BookingIncident;
use App\Models\BookingRefund;
use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\Place;
use App\Models\RideBooking;
use App\Models\RideDispatchAttempt;
use App\Models\Role;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourDriverAssignment;
use App\Models\TourSchedule;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Wallet;
use App\Services\DriverDispatchService;
use App\Services\RideEstimateService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;

it('classifies short, long, hourly, and round trip ride estimates', function () {
    $service = app(RideEstimateService::class);

    expect($service->classify('point_to_point', 12))->toBe('short_ride')
        ->and($service->classify('point_to_point', 80))->toBe('long_ride')
        ->and($service->classify('hourly_rental', 1))->toBe('long_ride')
        ->and($service->normalizeServiceType('hourly_rental'))->toBe('hourly')
        ->and($service->classify('round_trip', 5))->toBe('long_ride');
});

it('creates rides with estimated distance and normalized hourly service type', function () {
    Event::fake();

    $customer = Customer::create([
        'name' => 'Asha Customer',
        'phone' => '9000000001',
        'email' => 'asha@example.com',
        'is_active' => true,
    ]);
    $driver = Driver::create([
        'name' => 'Nearby Driver',
        'phone' => '8000000010',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_long_ride' => true,
        'rating' => 4.8,
    ]);
    $category = CarCategory::create([
        'name' => 'Hourly Sedan', 'slug' => 'hourly-sedan', 'vehicle_type' => 'sedan',
        'seats' => 4, 'base_price_per_day' => 1700, 'is_active' => true,
    ]);
    Vehicle::create([
        'driver_id' => $driver->id, 'car_category_id' => $category->id,
        'registration_number' => 'KA01SV0010', 'make' => 'Toyota', 'model' => 'Etios',
        'year' => 2024, 'color' => 'White', 'seats' => 4,
        'is_active' => true, 'approval_status' => 'approved',
    ]);
    DriverAvailability::create([
        'driver_id' => $driver->id,
        'is_available' => true,
        'status' => 'online',
        'current_lat' => 12.9717,
        'current_lng' => 77.5947,
    ]);

    Sanctum::actingAs($customer);

    $response = $this->postJson('/api/customer-app/rides', [
        'service_type' => 'hourly_rental',
        'pickup_location' => 'MG Road',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'Mysore Palace',
        'dropoff_lat' => 12.3052,
        'dropoff_lng' => 76.6552,
        'scheduled_at' => now()->addDay()->toISOString(),
        'payment_method' => 'cash',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('dispatch.classification', 'long_ride')
        ->assertJsonPath('dispatch.candidate_driver_ids.0', $driver->id)
        ->assertJsonPath('dispatch.admin_assignable', false);

    $ride = RideBooking::first();

    expect($ride->service_type)->toBe('hourly')
        ->and((float) $ride->estimated_distance_km)->toBeGreaterThan(0.0);

    $this->assertDatabaseHas('ride_dispatch_attempts', [
        'ride_booking_id' => $ride->id,
        'driver_id' => $driver->id,
        'status' => 'offered',
        'rank' => 1,
    ]);

    $this->assertDatabaseHas('ride_bookings', [
        'id' => $ride->id,
        'dispatch_status' => 'offered',
        'admin_assignable' => false,
    ]);
});

it('broadcasts ride requests to available and targeted driver channels', function () {
    $customer = Customer::create(['name' => 'Broadcast Customer', 'phone' => '9000000090']);
    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'A',
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 10,
        'total_fare' => 250,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    $event = new NewRideRequest($ride, [11, 22]);
    $channelNames = collect($event->broadcastOn())
        ->map(fn ($channel) => $channel->name)
        ->all();

    expect($channelNames)->toBe(['private-drivers.available', 'private-driver.11', 'private-driver.22'])
        ->and($event->broadcastWith()['targeted'])->toBeTrue();
});

it('settles a completed cash ride and exposes earnings and customer completion', function () {
    Event::fake();

    $customer = Customer::create([
        'name' => 'Completed Ride Customer',
        'phone' => '9000000088',
        'is_active' => true,
    ]);
    $driver = Driver::create([
        'name' => 'Completed Ride Driver',
        'phone' => '8000000088',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
    ]);
    DriverAvailability::create([
        'driver_id' => $driver->id,
        'is_available' => false,
        'status' => 'on_ride',
    ]);
    $ride = RideBooking::create([
        'booking_number' => RideBooking::generateBookingNumber(),
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Station',
        'dropoff_location' => 'Hotel',
        'scheduled_at' => now(),
        'estimated_distance_km' => 12,
        'total_fare' => 500,
        'status' => 'in_transit',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
        'start_pin_verified_at' => now(),
    ]);

    Sanctum::actingAs($driver);
    $this->postJson("/api/driver-app/tracking/ride/{$ride->id}/status", ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.payment_status', 'paid')
        ->assertJsonPath('data.driver_share', '400.00');

    $this->getJson('/api/driver-app/dashboard')
        ->assertOk()
        ->assertJsonPath('stats.earnings', 400);
    $this->getJson('/api/driver-app/wallet')
        ->assertOk()
        ->assertJsonPath('data.balance', '0.00')
        ->assertJsonPath('data.weekly_earnings', 400);

    Sanctum::actingAs($customer);
    $this->getJson("/api/customer-app/tracking/ride/{$ride->id}")
        ->assertOk()
        ->assertJsonPath('data.booking.status', 'completed')
        ->assertJsonPath('data.status_steps.4.key', 'completed')
        ->assertJsonPath('data.status_steps.4.done', true);

    expect((float) $ride->fresh()->commission_amount)->toBe(100.0)
        ->and((float) $ride->fresh()->driver_share)->toBe(400.0)
        ->and($ride->fresh()->payment_status)->toBe('paid');
});

it('puts rides with no eligible drivers into the admin dispatch queue', function () {
    Event::fake();

    $admin = User::create([
        'name' => 'Queue Admin',
        'email' => 'queue-admin@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $customer = Customer::create([
        'name' => 'Queue Customer',
        'phone' => '9000000091',
        'is_active' => true,
    ]);

    Sanctum::actingAs($customer);

    $response = $this->postJson('/api/customer-app/rides', [
        'service_type' => 'point_to_point',
        'pickup_location' => 'Remote Hill',
        'pickup_lat' => 19.0760,
        'pickup_lng' => 72.8777,
        'dropoff_location' => 'Remote Fort',
        'dropoff_lat' => 19.0800,
        'dropoff_lng' => 72.8800,
        'scheduled_at' => now()->addDay()->toISOString(),
        'payment_method' => 'cash',
    ]);

    $response->assertCreated()
        ->assertJsonPath('dispatch.candidate_count', 0)
        ->assertJsonPath('dispatch.admin_assignable', true)
        ->assertJsonPath('dispatch.dispatch_status', 'admin_queue');

    $ride = RideBooking::firstOrFail();

    $this->assertDatabaseHas('ride_bookings', [
        'id' => $ride->id,
        'dispatch_status' => 'admin_queue',
        'admin_assignable' => true,
    ]);

    $this->actingAs($admin)
        ->getJson('/admin/ride-bookings?dispatch_status=admin_queue&admin_assignable=1')
        ->assertOk()
        ->assertJsonPath('data.0.id', $ride->id);
});

it('stores ride reviews and tips using valid schema columns', function () {
    $customer = Customer::create(['name' => 'Review Customer', 'phone' => '9000000002']);
    $driver = Driver::create([
        'name' => 'Review Driver',
        'phone' => '8000000002',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'A',
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 10,
        'total_fare' => 200,
        'status' => 'completed',
        'payment_status' => 'paid',
        'payment_method' => 'cash',
    ]);

    Sanctum::actingAs($customer);

    $this->postJson("/api/customer-app/rides/{$ride->id}/review", [
        'rating' => 5,
        'comment' => 'Great drive',
    ])->assertOk();

    $this->assertDatabaseHas('ride_booking_reviews', [
        'ride_booking_id' => $ride->id,
        'driver_rating' => 5,
        'review' => 'Great drive',
    ]);
});

it('returns local and cached google place details separately', function () {
    $place = Place::create([
        'name' => 'City Palace',
        'slug' => 'city-palace',
        'is_active' => true,
        'latitude' => 26.9255,
        'longitude' => 75.8236,
        'google_place_id' => 'google-123',
        'google_rating' => 4.6,
        'google_review_count' => 1200,
        'google_reviews' => [['author' => 'Google User', 'rating' => 5, 'text' => 'Beautiful']],
        'google_photos' => [['photo_reference' => 'photo-1']],
        'google_details' => [
            'formatted_address' => 'City Palace Road, Jaipur',
            'website' => 'https://example.com/city-palace',
            'opening_hours' => ['open_now' => true, 'weekday_text' => ['Monday: 9:00 AM – 5:00 PM']],
        ],
        'google_synced_at' => now(),
    ]);

    $customer = Customer::create(['name' => 'Place Reviewer', 'phone' => '9000000003']);
    Sanctum::actingAs($customer);

    $this->postJson("/api/customer-app/places/{$place->id}/reviews", [
        'rating' => 4,
        'review' => 'Worth visiting',
    ])->assertOk();

    $this->getJson("/api/customer-app/public/places/{$place->id}")
        ->assertOk()
        ->assertJsonPath('data.google_summary.place_id', 'google-123')
        ->assertJsonPath('data.google_summary.details.formatted_address', 'City Palace Road, Jaipur')
        ->assertJsonPath('data.skyslope_reviews.0.review', 'Worth visiting');
});

it('syncs google place details into the local place cache', function () {
    config(['services.google_maps.api_key' => 'fake-google-key']);

    Http::fake([
        'https://maps.googleapis.com/maps/api/place/details/json*' => Http::response([
            'status' => 'OK',
            'result' => [
                'place_id' => 'google-sync-123',
                'rating' => 4.7,
                'user_ratings_total' => 321,
                'formatted_address' => 'MI Road, Jaipur, Rajasthan',
                'formatted_phone_number' => '0141 123 4567',
                'website' => 'https://example.com/place',
                'url' => 'https://maps.google.com/?cid=123',
                'business_status' => 'OPERATIONAL',
                'types' => ['tourist_attraction', 'point_of_interest'],
                'opening_hours' => ['open_now' => true, 'weekday_text' => ['Monday: Open 24 hours']],
                'geometry' => [
                    'location' => ['lat' => 26.9124, 'lng' => 75.7873],
                ],
                'reviews' => [[
                    'author_name' => 'Google Reviewer',
                    'rating' => 5,
                    'relative_time_description' => 'a week ago',
                    'text' => 'Excellent stop.',
                    'time' => 1710000000,
                ]],
                'photos' => [[
                    'photo_reference' => 'photo-reference-1',
                    'height' => 800,
                    'width' => 1200,
                    'html_attributions' => ['Attribution'],
                ]],
            ],
        ]),
    ]);

    $admin = User::create([
        'name' => 'Google Admin',
        'email' => 'google-admin@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $place = Place::create([
        'name' => 'Google Sync Place',
        'slug' => 'google-sync-place',
        'is_active' => true,
        'google_place_id' => 'google-sync-123',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/places/{$place->id}/sync-google")
        ->assertOk()
        ->assertJsonPath('status', 'synced')
        ->assertJsonPath('place.google_rating', '4.70')
        ->assertJsonPath('place.google_review_count', 321);

    $this->assertDatabaseHas('places', [
        'id' => $place->id,
        'google_rating' => 4.7,
        'google_review_count' => 321,
        'latitude' => 26.9124,
        'longitude' => 75.7873,
    ]);

    expect($place->fresh()->google_reviews[0]['author_name'])->toBe('Google Reviewer')
        ->and($place->fresh()->google_photos[0]['photo_reference'])->toBe('photo-reference-1')
        ->and($place->fresh()->google_details['formatted_address'])->toBe('MI Road, Jaipur, Rajasthan')
        ->and($place->fresh()->google_details['opening_hours']['open_now'])->toBeTrue();

    Http::assertSent(fn ($request) => $request['place_id'] === 'google-sync-123'
        && str_contains($request['fields'], 'reviews'));
});

it('serves cached Google place photos through signed API URLs', function () {
    config(['services.google_maps.api_key' => 'fake-google-key']);
    Http::fake([
        'https://maps.googleapis.com/maps/api/place/photo*' => Http::response('image-bytes', 200, ['Content-Type' => 'image/jpeg']),
    ]);

    $place = Place::create([
        'name' => 'Photo Place',
        'slug' => 'photo-place',
        'is_active' => true,
        'google_place_id' => 'photo-place-id',
        'google_photos' => [['photo_reference' => 'signed-photo-reference']],
    ]);

    $details = $this->getJson("/api/customer-app/public/places/{$place->id}")
        ->assertOk()
        ->assertJsonPath('data.google_summary.photos.0.photo_reference', 'signed-photo-reference');

    $this->get($details->json('data.google_summary.photos.0.url'))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/jpeg');
});

it('skips google place sync cleanly when api key is missing', function () {
    config(['services.google_maps.api_key' => null]);
    Http::fake();

    $admin = User::create([
        'name' => 'Missing Google Key Admin',
        'email' => 'missing-google-key-admin@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $place = Place::create([
        'name' => 'Missing Key Place',
        'slug' => 'missing-key-place',
        'is_active' => true,
        'google_place_id' => 'missing-key-google-id',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/places/{$place->id}/sync-google")
        ->assertOk()
        ->assertJsonPath('status', 'skipped')
        ->assertJsonPath('message', 'Google Maps API key is not configured.');

    expect($place->fresh()->google_synced_at)->toBeNull();
    Http::assertNothingSent();
});

it('lets drivers accept and complete tour assignments and rental assignments', function () {
    $customer = Customer::create(['name' => 'Tour Customer', 'phone' => '9000000004']);
    $driver = Driver::create([
        'name' => 'Tour Driver',
        'phone' => '8000000004',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_tour_transport' => true,
        'can_rental_delivery' => true,
    ]);

    DriverAvailability::create([
        'driver_id' => $driver->id,
        'is_available' => true,
        'status' => 'online',
    ]);

    $tour = Tour::create([
        'title' => 'Jaipur Highlights',
        'slug' => 'jaipur-highlights',
        'duration_days' => 1,
        'duration_nights' => 0,
        'price_per_person' => 1000,
        'child_price' => 500,
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

    $assignment = TourDriverAssignment::create([
        'tour_schedule_id' => $schedule->id,
        'driver_id' => $driver->id,
        'role' => 'transport',
        'status' => 'assigned',
    ]);

    $category = CarCategory::create([
        'name' => 'Sedan',
        'slug' => 'sedan',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 1500,
    ]);

    Vehicle::create([
        'driver_id' => $driver->id,
        'car_category_id' => $category->id,
        'registration_number' => 'KA01TOUR01',
        'make' => 'Toyota',
        'model' => 'Etios',
        'year' => 2024,
        'color' => 'White',
        'seats' => 4,
        'is_active' => true,
        'approval_status' => 'approved',
    ]);

    $rental = CarRental::create([
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'car_category_id' => $category->id,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'start_date' => now()->addDays(2)->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
        'number_of_days' => 2,
        'pickup_location' => 'Airport',
        'base_price' => 3000,
        'total_price' => 3000,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
    ]);

    Sanctum::actingAs($driver);

    // Finish the existing rental before accepting tour work; drivers cannot
    // be engaged by two modules at the same time.
    $this->postJson("/api/driver-app/rentals/{$rental->id}/complete")->assertOk();
    $this->assertDatabaseHas('car_rentals', ['id' => $rental->id, 'status' => 'completed']);

    $this->postJson("/api/driver-app/tour-assignments/{$assignment->id}/accept")->assertOk();
    $this->assertDatabaseHas('tour_driver_assignments', ['id' => $assignment->id, 'status' => 'accepted']);

    $this->postJson("/api/driver-app/tour-assignments/{$assignment->id}/complete")->assertOk();
    $this->assertDatabaseHas('tour_driver_assignments', ['id' => $assignment->id, 'status' => 'completed']);

});

it('rejects guide app routes with a deprecated response', function () {
    $this->postJson('/api/guide-app/otp/send', ['phone' => '7000000000'])
        ->assertStatus(410)
        ->assertJsonPath('success', false);

    expect(Route::has('admin.tours.schedules.assign-guide'))->toBeFalse()
        ->and(Route::has('admin.tours.schedules.assign-driver'))->toBeTrue();
});

it('lets admin confirm and cancel tour bookings while syncing seat inventory', function () {
    $admin = User::create([
        'name' => 'Admin User',
        'email' => 'admin@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $customer = Customer::create(['name' => 'Seat Customer', 'phone' => '9000000005']);
    $tour = Tour::create([
        'title' => 'Seat Tour',
        'slug' => 'seat-tour',
        'duration_days' => 1,
        'duration_nights' => 0,
        'price_per_person' => 1000,
        'child_price' => 500,
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
        'reserved_seats' => 2,
        'status' => 'open',
    ]);
    $booking = TourBooking::create([
        'customer_id' => $customer->id,
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 2,
        'number_of_children' => 0,
        'travel_date' => $schedule->departure_date,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'price_per_adult' => 1000,
        'price_per_child' => 500,
        'subtotal' => 2000,
        'total_price' => 2000,
        'status' => 'pending',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/tour-bookings/{$booking->id}/update-status", [
            'status' => 'confirmed',
            'payment_status' => 'paid',
        ])
        ->assertOk();

    $this->assertDatabaseHas('tour_schedules', [
        'id' => $schedule->id,
        'reserved_seats' => 0,
        'booked_seats' => 2,
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/tour-bookings/{$booking->id}/update-status", [
            'status' => 'cancelled',
            'cancellation_reason' => 'Customer request',
        ])
        ->assertOk();

    $this->assertDatabaseHas('tour_schedules', [
        'id' => $schedule->id,
        'reserved_seats' => 0,
        'booked_seats' => 0,
    ]);
});

it('lets admin assign and complete car rentals using driver and vehicle columns', function () {
    $admin = User::create([
        'name' => 'Rental Admin',
        'email' => 'rental-admin@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $customer = Customer::create(['name' => 'Rental Customer', 'phone' => '9000000006']);
    $driver = Driver::create([
        'name' => 'Rental Driver',
        'phone' => '8000000006',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_rental_delivery' => true,
    ]);
    DriverAvailability::create([
        'driver_id' => $driver->id,
        'is_available' => true,
        'status' => 'online',
    ]);
    $category = CarCategory::create([
        'name' => 'SUV',
        'slug' => 'suv',
        'vehicle_type' => 'suv',
        'seats' => 6,
        'base_price_per_day' => 2500,
    ]);
    $vehicle = \App\Models\Vehicle::create([
        'car_category_id' => $category->id,
        'driver_id' => $driver->id,
        'registration_number' => 'KA01AB1234',
        'make' => 'Toyota',
        'model' => 'Innova',
        'year' => 2024,
        'color' => 'White',
        'seats' => 6,
        'is_active' => true,
    ]);
    $rental = CarRental::create([
        'customer_id' => $customer->id,
        'car_category_id' => $category->id,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'start_date' => now()->addDays(2)->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
        'number_of_days' => 2,
        'pickup_location' => 'Hotel',
        'base_price' => 5000,
        'total_price' => 5000,
        'status' => 'confirmed',
        'payment_status' => 'pending',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/car-rentals/{$rental->id}/assign-driver", [
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ])
        ->assertOk();

    $this->assertDatabaseHas('car_rentals', [
        'id' => $rental->id,
        'driver_id' => $driver->id,
        'vehicle_id' => $vehicle->id,
        'status' => 'driver_assigned',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/car-rentals/{$rental->id}/update-status", [
            'status' => 'completed',
            'payment_status' => 'paid',
        ])
        ->assertOk();

    $this->assertDatabaseHas('driver_availabilities', [
        'driver_id' => $driver->id,
        'status' => 'online',
        'is_available' => true,
    ]);
});

it('returns validation errors for insufficient wallet bookings without leaking inventory', function () {
    $customer = Customer::create(['name' => 'Wallet Customer', 'phone' => '9000000007']);
    Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 1,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $tour = Tour::create([
        'title' => 'Wallet Tour',
        'slug' => 'wallet-tour',
        'duration_days' => 1,
        'duration_nights' => 0,
        'price_per_person' => 1000,
        'child_price' => 500,
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
    $category = CarCategory::create([
        'name' => 'Budget',
        'slug' => 'budget',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 2000,
    ]);

    Sanctum::actingAs($customer);

    $this->postJson('/api/customer-app/tours/book', [
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 2,
        'payment_method' => 'wallet',
    ])->assertStatus(422)
        ->assertJsonPath('message', 'Insufficient wallet balance.');

    $this->assertDatabaseHas('tour_schedules', [
        'id' => $schedule->id,
        'reserved_seats' => 0,
        'booked_seats' => 0,
    ]);
    $this->assertDatabaseCount('tour_bookings', 0);

    $this->postJson('/api/customer-app/car-rentals', [
        'car_category_id' => $category->id,
        'start_date' => now()->addDays(2)->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
        'pickup_location' => 'Station',
        'payment_method' => 'wallet',
    ])->assertStatus(422)
        ->assertJsonPath('message', 'Insufficient wallet balance.');

    $this->assertDatabaseCount('car_rentals', 0);

    $this->postJson('/api/customer-app/rides', [
        'service_type' => 'point_to_point',
        'pickup_location' => 'A',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'B',
        'dropoff_lat' => 12.9816,
        'dropoff_lng' => 77.6046,
        'scheduled_at' => now()->addDay()->toISOString(),
        'payment_method' => 'wallet',
    ])->assertStatus(422)
        ->assertJsonPath('message', 'Insufficient wallet balance.');

    $this->assertDatabaseCount('ride_bookings', 0);
});

it('refunds wallet-paid ride cancellations through auditable booking refunds', function () {
    $admin = User::create([
        'name' => 'Refund Admin',
        'email' => 'refund-admin@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $customer = Customer::create(['name' => 'Refund Customer', 'phone' => '9000000008']);
    Wallet::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'balance' => 0,
        'currency' => 'INR',
        'is_active' => true,
    ]);

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'A',
        'scheduled_at' => now()->addDays(2),
        'estimated_distance_km' => 10,
        'total_fare' => 500,
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'payment_method' => 'wallet',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/ride-bookings/{$ride->id}/update-status", [
            'status' => 'cancelled',
            'cancellation_reason' => 'Customer changed plans',
        ])
        ->assertOk();

    $this->assertDatabaseHas('ride_bookings', [
        'id' => $ride->id,
        'status' => 'cancelled',
        'payment_status' => 'refunded',
        'refund_amount' => 500,
        'cancellation_fee' => 0,
    ]);

    $this->assertDatabaseHas('booking_refunds', [
        'refundable_type' => RideBooking::class,
        'refundable_id' => $ride->id,
        'amount' => 500,
        'status' => 'processed',
    ]);

    $this->assertDatabaseHas('booking_audit_logs', [
        'auditable_type' => RideBooking::class,
        'auditable_id' => $ride->id,
        'admin_id' => $admin->id,
        'action' => 'cancelled',
    ]);

    expect((float) Wallet::forOwner($customer)->first()->fresh()->balance)->toBe(500.0);
});

it('creates pending non-wallet refunds and lets admin process them to wallet', function () {
    $admin = User::create([
        'name' => 'Manual Refund Admin',
        'email' => 'manual-refund-admin@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $customer = Customer::create(['name' => 'Manual Refund Customer', 'phone' => '9000000009']);
    $category = CarCategory::create([
        'name' => 'Executive',
        'slug' => 'executive',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 3000,
    ]);
    $rental = CarRental::create([
        'customer_id' => $customer->id,
        'car_category_id' => $category->id,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'start_date' => now()->addDays(3)->toDateString(),
        'end_date' => now()->addDays(4)->toDateString(),
        'number_of_days' => 2,
        'pickup_location' => 'Airport',
        'base_price' => 6000,
        'total_price' => 6000,
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'payment_method' => 'cash',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/car-rentals/{$rental->id}/update-status", [
            'status' => 'cancelled',
            'cancellation_reason' => 'Weather cancellation',
        ])
        ->assertOk();

    $refund = BookingRefund::firstOrFail();

    expect($refund->status)->toBe('pending')
        ->and((float) $refund->amount)->toBe(6000.0);

    $this->actingAs($admin)
        ->postJson("/admin/booking-refunds/{$refund->id}/process")
        ->assertOk()
        ->assertJsonPath('refund.status', 'processed');

    $this->assertDatabaseHas('car_rentals', [
        'id' => $rental->id,
        'payment_status' => 'refunded',
        'refund_amount' => 6000,
    ]);

    expect((float) Wallet::forOwner($customer)->first()->fresh()->balance)->toBe(6000.0);
});

it('records and resolves booking incidents for no-shows and disputes', function () {
    $admin = User::create([
        'name' => 'Incident Admin',
        'email' => 'incident-admin@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $customer = Customer::create(['name' => 'Incident Customer', 'phone' => '9000000010']);
    $driver = Driver::create([
        'name' => 'Incident Driver',
        'phone' => '8000000010',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Hotel',
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 8,
        'total_fare' => 350,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/ride-bookings/{$ride->id}/incidents", [
            'type' => 'no_show',
            'severity' => 'high',
            'title' => 'Customer did not arrive at pickup',
            'description' => 'Driver waited beyond the grace period.',
        ])
        ->assertCreated()
        ->assertJsonPath('incident.type', 'no_show')
        ->assertJsonPath('incident.status', 'open');

    $incident = BookingIncident::firstOrFail();

    $this->actingAs($admin)
        ->patchJson("/admin/booking-incidents/{$incident->id}", [
            'status' => 'resolved',
            'resolution' => 'Customer contacted and admin waived the fee.',
        ])
        ->assertOk()
        ->assertJsonPath('incident.status', 'resolved');

    $this->assertDatabaseHas('booking_incidents', [
        'id' => $incident->id,
        'incidentable_type' => RideBooking::class,
        'incidentable_id' => $ride->id,
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'type' => 'no_show',
        'severity' => 'high',
        'status' => 'resolved',
    ]);

    $audit = BookingAuditLog::where('auditable_type', RideBooking::class)
        ->where('auditable_id', $ride->id)
        ->where('action', 'incident_created')
        ->firstOrFail();

    expect($audit->after['incident_id'])->toBe($incident->id)
        ->and($audit->after['type'])->toBe('no_show');
});

it('filters dispatch and admin assignment by vehicle category and pickup radius', function () {
    $admin = User::create([
        'name' => 'Eligibility Admin',
        'email' => 'eligibility-admin@example.com',
        'password' => 'password',
    ]);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $customer = Customer::create(['name' => 'Eligibility Customer', 'phone' => '9000000011']);
    $sedan = CarCategory::create([
        'name' => 'Sedan Category',
        'slug' => 'sedan-category',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 1500,
    ]);
    $suv = CarCategory::create([
        'name' => 'SUV Category',
        'slug' => 'suv-category',
        'vehicle_type' => 'suv',
        'seats' => 6,
        'base_price_per_day' => 2500,
    ]);

    $matchingDriver = Driver::create([
        'name' => 'Matching Driver',
        'phone' => '8000000011',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
        'rating' => 4.9,
    ]);
    $wrongVehicleDriver = Driver::create([
        'name' => 'Wrong Vehicle Driver',
        'phone' => '8000000012',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
        'rating' => 5.0,
    ]);
    $farDriver = Driver::create([
        'name' => 'Far Driver',
        'phone' => '8000000013',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
        'rating' => 4.8,
    ]);

    $matchingVehicle = Vehicle::create([
        'car_category_id' => $sedan->id,
        'driver_id' => $matchingDriver->id,
        'registration_number' => 'KA01EL1111',
        'make' => 'Honda',
        'model' => 'City',
        'year' => 2024,
        'color' => 'Blue',
        'seats' => 4,
        'is_active' => true,
    ]);
    $wrongVehicle = Vehicle::create([
        'car_category_id' => $suv->id,
        'driver_id' => $wrongVehicleDriver->id,
        'registration_number' => 'KA01EL2222',
        'make' => 'Toyota',
        'model' => 'Fortuner',
        'year' => 2024,
        'color' => 'Black',
        'seats' => 6,
        'is_active' => true,
    ]);

    DriverAvailability::create([
        'driver_id' => $matchingDriver->id,
        'is_available' => true,
        'status' => 'online',
        'current_lat' => 12.9716,
        'current_lng' => 77.5946,
    ]);
    DriverAvailability::create([
        'driver_id' => $wrongVehicleDriver->id,
        'is_available' => true,
        'status' => 'online',
        'current_lat' => 12.9717,
        'current_lng' => 77.5947,
    ]);
    DriverAvailability::create([
        'driver_id' => $farDriver->id,
        'is_available' => true,
        'status' => 'online',
        'current_lat' => 13.5000,
        'current_lng' => 78.5000,
    ]);

    $candidates = app(DriverDispatchService::class)->rankedCandidates(
        'short_ride',
        12.9716,
        77.5946,
        null,
        10,
        $sedan->id
    );

    expect($candidates->pluck('driver_id')->all())->toBe([$matchingDriver->id]);

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'car_category_id' => $sedan->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'MG Road',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 5,
        'total_fare' => 300,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/ride-bookings/{$ride->id}/assign-driver", [
            'driver_id' => $wrongVehicleDriver->id,
            'vehicle_id' => $wrongVehicle->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.driver_id.0', 'Selected vehicle does not match the requested car category.');

    $this->actingAs($admin)
        ->postJson("/admin/ride-bookings/{$ride->id}/assign-driver", [
            'driver_id' => $matchingDriver->id,
            'vehicle_id' => $matchingVehicle->id,
        ])
        ->assertOk();

    $this->assertDatabaseHas('ride_bookings', [
        'id' => $ride->id,
        'driver_id' => $matchingDriver->id,
        'vehicle_id' => $matchingVehicle->id,
        'status' => 'driver_assigned',
    ]);
});

it('tracks driver ride dispatch decline and accept history', function () {
    $customer = Customer::create(['name' => 'Dispatch Customer', 'phone' => '9000000012']);
    $decliningDriver = Driver::create([
        'name' => 'Declining Driver',
        'phone' => '8000000014',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
    ]);
    $acceptingDriver = Driver::create([
        'name' => 'Accepting Driver',
        'phone' => '8000000015',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
    ]);
    $category = CarCategory::create([
        'name' => 'Dispatch Sedan', 'slug' => 'dispatch-sedan', 'vehicle_type' => 'sedan',
        'seats' => 4, 'base_price_per_day' => 1500, 'is_active' => true,
    ]);
    foreach ([[$decliningDriver, 'KA01SV0014'], [$acceptingDriver, 'KA01SV0015']] as [$driver, $registration]) {
        Vehicle::create([
            'driver_id' => $driver->id, 'car_category_id' => $category->id,
            'registration_number' => $registration, 'make' => 'Maruti', 'model' => 'Dzire',
            'year' => 2024, 'color' => 'White', 'seats' => 4,
            'is_active' => true, 'approval_status' => 'approved',
        ]);
    }

    foreach ([$decliningDriver, $acceptingDriver] as $driver) {
        DriverAvailability::create([
            'driver_id' => $driver->id,
            'is_available' => true,
            'status' => 'online',
            'current_lat' => 12.9716,
            'current_lng' => 77.5946,
        ]);
    }

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Museum',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 6,
        'total_fare' => 320,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    RideDispatchAttempt::create([
        'ride_booking_id' => $ride->id,
        'driver_id' => $decliningDriver->id,
        'status' => 'offered',
        'rank' => 1,
        'offered_at' => now(),
        'expires_at' => now()->addMinute(),
    ]);
    RideDispatchAttempt::create([
        'ride_booking_id' => $ride->id,
        'driver_id' => $acceptingDriver->id,
        'status' => 'offered',
        'rank' => 2,
        'offered_at' => now(),
        'expires_at' => now()->addMinute(),
    ]);

    Sanctum::actingAs($decliningDriver);

    $this->postJson("/api/driver-app/rides/{$ride->id}/decline", [
        'reason' => 'Too far',
    ])->assertOk()
        ->assertJsonPath('attempt.status', 'declined');

    $this->getJson('/api/driver-app/pending-rides')
        ->assertOk()
        ->assertJsonCount(0, 'rides');

    Sanctum::actingAs($acceptingDriver);

    $this->postJson("/api/driver-app/rides/{$ride->id}/accept")
        ->assertOk()
        ->assertJsonPath('ride.id', $ride->id);

    $this->assertDatabaseHas('ride_dispatch_attempts', [
        'ride_booking_id' => $ride->id,
        'driver_id' => $decliningDriver->id,
        'status' => 'declined',
    ]);
    $this->assertDatabaseHas('ride_dispatch_attempts', [
        'ride_booking_id' => $ride->id,
        'driver_id' => $acceptingDriver->id,
        'status' => 'accepted',
    ]);
    $this->assertDatabaseHas('ride_bookings', [
        'id' => $ride->id,
        'driver_id' => $acceptingDriver->id,
        'status' => 'driver_assigned',
    ]);
});

it('scores scheduled workload and expires stale ride dispatch attempts', function () {
    $customer = Customer::create(['name' => 'Expiry Customer', 'phone' => '9000000013']);
    $driver = Driver::create([
        'name' => 'Busy Future Driver',
        'phone' => '8000000016',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
    ]);
    DriverAvailability::create([
        'driver_id' => $driver->id,
        'is_available' => true,
        'status' => 'online',
        'current_lat' => 12.9716,
        'current_lng' => 77.5946,
    ]);

    $futureRide = RideBooking::create([
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Future Pickup',
        'scheduled_at' => now()->addDays(2),
        'estimated_distance_km' => 12,
        'total_fare' => 420,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);
    $openRide = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Open Pickup',
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 7,
        'total_fare' => 350,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    RideDispatchAttempt::create([
        'ride_booking_id' => $openRide->id,
        'driver_id' => $driver->id,
        'status' => 'offered',
        'offered_at' => now()->subMinutes(3),
        'expires_at' => now()->subMinute(),
    ]);

    expect(app(DriverDispatchService::class)->workloadScore($driver))->toBe(1);

    Artisan::call('dispatch:expire-ride-attempts');

    $this->assertDatabaseHas('ride_dispatch_attempts', [
        'ride_booking_id' => $openRide->id,
        'driver_id' => $driver->id,
        'status' => 'expired',
    ]);
    expect(Artisan::output())->toContain('Expired 1 ride dispatch attempt');
});

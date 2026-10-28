<?php

use App\Models\Customer;
use App\Models\OutboxMessage;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourCategory;
use App\Models\TourSchedule;

it('dispatches departure reminders to outbox for confirmed bookings within the reminder window and deduplicates them', function () {
    $customer = Customer::create([
        'name' => 'Reminder Customer',
        'phone' => '9876500001',
        'email' => 'reminder@example.com',
    ]);

    $category = TourCategory::create(['name' => 'Trek', 'slug' => 'trek-reminder', 'is_active' => true]);
    $tour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Dzukou Valley Trek',
        'slug' => 'dzukou-valley-trek',
        'price_per_person' => 2500,
        'is_active' => true,
        'start_location' => 'Kohima',
    ]);

    // Schedule departing in 16 hours (inside 24h window)
    $upcomingSchedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addHours(16)->toDateString(),
        'departure_time' => now()->addHours(16)->format('H:i:s'),
        'return_date' => now()->addDays(3)->toDateString(),
        'departure_point' => 'Main Gate Kohima',
        'total_seats' => 10,
        'booked_seats' => 2,
        'status' => 'open',
    ]);

    // Booking for upcoming schedule
    $booking = TourBooking::create([
        'customer_id' => $customer->id,
        'tour_id' => $tour->id,
        'tour_schedule_id' => $upcomingSchedule->id,
        'travel_date' => $upcomingSchedule->departure_date,
        'number_of_adults' => 2,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'customer_email' => $customer->email,
        'price_per_adult' => 2500,
        'total_price' => 5000,
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'sms_notification' => true,
        'whatsapp_notification' => false,
        'email_notification' => true,
    ]);

    // Schedule departing in 48 hours (outside 24h window)
    $farSchedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addDays(2)->toDateString(),
        'departure_time' => '10:00:00',
        'return_date' => now()->addDays(4)->toDateString(),
        'departure_point' => 'Main Gate Kohima',
        'total_seats' => 10,
        'booked_seats' => 1,
        'status' => 'open',
    ]);

    $farBooking = TourBooking::create([
        'customer_id' => $customer->id,
        'tour_id' => $tour->id,
        'tour_schedule_id' => $farSchedule->id,
        'travel_date' => $farSchedule->departure_date,
        'number_of_adults' => 1,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'price_per_adult' => 2500,
        'total_price' => 2500,
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'payment_method' => 'cash',
    ]);

    // Run command with 24 hours window
    $this->artisan('tours:send-departure-reminders --hours=24')
        ->expectsOutput('Dispatched departure reminders for 1 booking(s).')
        ->assertSuccessful();

    // Verify outbox messages were enqueued for upcoming booking, but NOT for far booking
    $messages = OutboxMessage::where('dedup_key', 'like', "booking:tour:{$booking->id}:booking.departure_reminder:24h%")->get();
    expect($messages)->not->toBeEmpty()
        ->and($messages->first()->body)->toContain('Reminder: Your Tour booking')
        ->and($messages->first()->body)->toContain('Main Gate Kohima');

    $farMessages = OutboxMessage::where('dedup_key', 'like', "booking:tour:{$farBooking->id}:%")->get();
    expect($farMessages)->toBeEmpty();

    // Deduplication test: Running command a second time must NOT create duplicate outbox entries
    $initialCount = OutboxMessage::count();
    $this->artisan('tours:send-departure-reminders --hours=24')
        ->expectsOutput('Dispatched departure reminders for 0 booking(s).')
        ->assertSuccessful();

    expect(OutboxMessage::count())->toBe($initialCount);
});

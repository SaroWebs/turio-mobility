<?php

use App\Models\Customer;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourSchedule;
use App\Models\TourShare;
use App\Services\MtalkzSmsService;
use Laravel\Sanctum\Sanctum;

function sharedTourFixture(): array
{
    $customer = Customer::create(['name' => 'Owner', 'phone' => '9876543210']);
    $tour = Tour::create(['title' => 'Tawang holiday', 'slug' => 'tawang-holiday', 'price_per_person' => 1000, 'is_active' => true, 'start_location' => 'Guwahati']);
    $schedule = TourSchedule::create(['tour_id' => $tour->id, 'departure_date' => now()->addDays(4), 'return_date' => now()->addDays(6), 'total_seats' => 2, 'status' => 'open']);
    $booking = TourBooking::create(['customer_id' => $customer->id, 'tour_id' => $tour->id, 'tour_schedule_id' => $schedule->id,
        'travel_date' => $schedule->departure_date, 'number_of_adults' => 1, 'customer_name' => 'Owner', 'customer_phone' => $customer->phone,
        'price_per_adult' => 1000, 'subtotal' => 1000, 'total_price' => 1000, 'status' => 'confirmed', 'payment_status' => 'paid']);

    return [$customer, $tour, $schedule, $booking];
}

it('matches date and enough seats on the same departure before pagination', function () {
    [, $tour, $schedule] = sharedTourFixture();
    TourSchedule::create(['tour_id' => $tour->id, 'departure_date' => now()->addDays(8), 'return_date' => now()->addDays(9), 'total_seats' => 8, 'status' => 'open']);
    $date = $schedule->departure_date->toDateString();
    $this->getJson("/api/customer-app/public/tours?date={$date}&guests=4&page=1")->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('pagination.total', 0);
    $this->getJson("/api/customer-app/public/tours?date={$date}&guests=2&page=1")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.schedules.0.id', $schedule->id);
    $this->getJson('/api/customer-app/public/tours?guests=0')->assertUnprocessable();
});

it('requires the invited phone and a single use OTP and revokes scoped access', function () {
    [$owner, , $schedule, $booking] = sharedTourFixture();
    Sanctum::actingAs($owner);
    $invite = $this->postJson("/api/customer-app/tour-bookings/{$booking->id}/shares", ['name' => 'Friend', 'phone' => '9876543211'])->assertCreated()->json('data');
    $payload = ['token' => $invite['token'], 'phone' => '+919876543211'];
    $this->postJson('/api/customer-app/tour-shares/otp', [...$payload, 'phone' => '9876543212'])->assertNotFound();
    $code = null;
    $this->mock(MtalkzSmsService::class, function ($mock) use (&$code) {
        $mock->shouldReceive('isConfigured')->once()->andReturn(true);
        $mock->shouldReceive('send')->once()->andReturnUsing(function ($phone, $message) use (&$code) {
            preg_match('/\b(\d{6})\b/', $message, $match);
            $code = $match[1];

            return true;
        });
    });
    $this->postJson('/api/customer-app/tour-shares/otp', $payload)->assertOk();
    $this->postJson('/api/customer-app/tour-shares/otp', $payload)->assertStatus(429);
    $this->postJson('/api/customer-app/tour-shares/verify', [...$payload, 'code' => '000000'])->assertUnprocessable();
    expect(TourShare::find($invite['id'])->attempts)->toBe(1);
    $session = $this->postJson('/api/customer-app/tour-shares/verify', [...$payload, 'code' => $code])->assertOk()->json('data.session');
    $this->postJson('/api/customer-app/tour-shares/verify', [...$payload, 'code' => $code])->assertNotFound();
    $view = $this->getJson('/api/customer-app/tour-shares/view', ['X-Tour-Share-Session' => $session])->assertOk()->assertJsonPath('data.title', 'Tawang holiday')->json('data');
    expect(array_keys($view))->toBe(['title', 'status', 'travel_date', 'pickup', 'days']);
    expect($schedule->fresh()->reserved_seats)->toBe(0);
    $this->deleteJson("/api/customer-app/tour-bookings/{$booking->id}/shares/{$invite['id']}")->assertOk();
    $this->getJson('/api/customer-app/tour-shares/view', ['X-Tour-Share-Session' => $session])->assertNotFound();
});

it('rejects non owners and expired or terminal tour invitations', function () {
    [$owner, , , $booking] = sharedTourFixture();
    $other = Customer::create(['name' => 'Other', 'phone' => '9876543219']);
    Sanctum::actingAs($other);
    $this->postJson("/api/customer-app/tour-bookings/{$booking->id}/shares", ['name' => 'Friend', 'phone' => '9876543211'])->assertNotFound();
    Sanctum::actingAs($owner);
    $invite = $this->postJson("/api/customer-app/tour-bookings/{$booking->id}/shares", ['name' => 'Friend', 'phone' => '9876543211'])->assertCreated()->json('data');
    TourShare::find($invite['id'])->update(['expires_at' => now()->subMinute()]);
    $this->postJson('/api/customer-app/tour-shares/otp', ['token' => $invite['token'], 'phone' => '9876543211'])->assertNotFound();
    $booking->update(['status' => 'cancelled']);
    $this->postJson("/api/customer-app/tour-bookings/{$booking->id}/shares", ['name' => 'Friend', 'phone' => '9876543211'])->assertUnprocessable();
});

it('quotes without reserving seats and rejects changed or expired prices', function () {
    [$owner, $tour, $schedule] = sharedTourFixture();
    Sanctum::actingAs($owner);
    $payload = ['tour_id' => $tour->id, 'tour_schedule_id' => $schedule->id, 'number_of_adults' => 1, 'payment_method' => 'cash'];
    $quote = $this->postJson('/api/customer-app/tours/quote', $payload)->assertOk()->json('data');
    expect($schedule->fresh()->reserved_seats)->toBe(0);
    $this->postJson('/api/customer-app/tours/book', [...$payload, 'number_of_adults' => 2, 'quote_token' => $quote['quote_token']])->assertUnprocessable();
    $this->travel(11)->minutes();
    $this->postJson('/api/customer-app/tours/book', [...$payload, 'quote_token' => $quote['quote_token']])->assertUnprocessable();
    $this->travelBack();
    $this->postJson('/api/customer-app/tours/book', [...$payload, 'quote_token' => $quote['quote_token']])->assertCreated();
    expect($schedule->fresh()->reserved_seats)->toBe(1);
});

it('burns a sharing OTP after five failures and hides tours after cancellation', function () {
    [$owner, , , $booking] = sharedTourFixture();
    Sanctum::actingAs($owner);
    $invite = $this->postJson("/api/customer-app/tour-bookings/{$booking->id}/shares", ['name' => 'Friend', 'phone' => '9876543211'])->assertCreated()->json('data');
    $share = TourShare::findOrFail($invite['id']);
    $share->update(['otp_hash' => \Illuminate\Support\Facades\Hash::make('123456'), 'otp_expires_at' => now()->addMinutes(5)]);
    $payload = ['token' => $invite['token'], 'phone' => '9876543211'];
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->postJson('/api/customer-app/tour-shares/verify', [...$payload, 'code' => '000000'])->assertStatus($attempt === 4 ? 429 : 422);
    }
    $this->postJson('/api/customer-app/tour-shares/verify', [...$payload, 'code' => '123456'])->assertUnprocessable();
    $session = str_repeat('a', 64);
    $share->update(['verified_at' => now(), 'session_hash' => hash('sha256', $session), 'session_expires_at' => now()->addWeek()]);
    $booking->update(['status' => 'cancelled']);
    $this->getJson('/api/customer-app/tour-shares/view', ['X-Tour-Share-Session' => $session])->assertNotFound();
});

it('allows departure-day invitations until the exact departure instant', function () {
    config(['app.business_timezone' => 'Asia/Kolkata']);
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 04:00:00', 'UTC'));
    [$owner, , $schedule, $booking] = sharedTourFixture();
    $schedule->update(['departure_date' => '2026-09-25', 'departure_time' => '14:00:00', 'return_date' => '2026-09-26']);
    Sanctum::actingAs($owner);
    $url = "/api/customer-app/tour-bookings/{$booking->id}/shares";
    $invite = $this->postJson($url, ['name' => 'Friend', 'phone' => '9876543211'])->assertCreated()->json('data');
    $share = TourShare::findOrFail($invite['id']);
    expect($share->expires_at->format('Y-m-d H:i:s'))->toBe('2026-09-25 08:30:00');
    $this->travelTo($schedule->fresh()->departure_at);
    $this->postJson($url, ['name' => 'Other', 'phone' => '9876543212'])->assertUnprocessable();
    $this->postJson('/api/customer-app/tour-shares/otp', ['token' => $invite['token'], 'phone' => '9876543211'])->assertNotFound();
});

it('closes shared access at the business timezone return-day boundary', function () {
    config(['app.business_timezone' => 'Asia/Kolkata']);
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 18:29:59', 'UTC'));
    [, , $schedule, $booking] = sharedTourFixture();
    $schedule->update(['return_date' => '2026-09-25']);
    $share = new TourShare;
    $share->setRelation('booking', $booking->fresh('schedule'));
    expect($share->tripIsOpen())->toBeTrue();
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 18:30:00', 'UTC'));
    expect($share->tripIsOpen())->toBeFalse();
});

it('uses the departure time rather than midnight for cancellation fee windows', function () {
    config(['app.business_timezone' => 'Asia/Kolkata']);
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 04:00:00', 'UTC'));
    [, , $schedule, $booking] = sharedTourFixture();
    $schedule->update(['departure_date' => '2026-09-26', 'departure_time' => '15:30:00']);
    $service = app(\App\Services\BookingCancellationService::class);
    expect($service->calculateFee($booking->fresh(), 'tour'))->toBe(0.0);
    $this->travelTo(\Carbon\Carbon::parse('2026-09-26 04:00:00', 'UTC'));
    expect($service->calculateFee($booking->fresh(), 'tour'))->toBe(100.0);
});

it('derives UTC departure instants across daylight saving offsets', function (string $date, string $expected) {
    config(['app.business_timezone' => 'America/New_York']);
    [, , $schedule] = sharedTourFixture();
    $schedule->update(['departure_date' => $date, 'departure_time' => '09:00:00']);
    expect($schedule->fresh()->departure_at->format('Y-m-d H:i:s'))->toBe($expected);
})->with([
    ['2026-03-07', '2026-03-07 14:00:00'],
    ['2026-03-08', '2026-03-08 13:00:00'],
    ['2026-11-01', '2026-11-01 14:00:00'],
]);

it('agrees on business-calendar availability in search quote and booking', function (string $from, string $to, bool $available) {
    config(['app.business_timezone' => 'Asia/Kolkata']);
    // Local September 26 while the server is still on September 25.
    $this->travelTo(\Carbon\Carbon::parse('2026-09-25 19:00:00', 'UTC'));
    [$owner, $tour, $schedule] = sharedTourFixture();
    $tour->update(['available_from' => $from, 'available_to' => $to]);
    $search = $this->getJson('/api/customer-app/public/tours?guests=1')->assertOk()->json('data');
    expect(collect($search)->contains('id', $tour->id))->toBe($available);
    expect($tour->fresh()->isAvailableForGuests(1))->toBe($available);
    Sanctum::actingAs($owner);
    $payload = ['tour_id' => $tour->id, 'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 1, 'payment_method' => 'cash'];
    $quote = $this->postJson('/api/customer-app/tours/quote', $payload)->assertStatus($available ? 200 : 422);
    expect((int) $schedule->fresh()->reserved_seats)->toBe(0);
    if ($available) {
        $payload['quote_token'] = $quote->json('data.quote_token');
    }
    $this->postJson('/api/customer-app/tours/book', $payload)->assertStatus($available ? 201 : 422);
    expect((int) $schedule->fresh()->reserved_seats)->toBe($available ? 1 : 0);
})->with([
    ['2026-09-26', '2026-09-26', true],
    ['2026-09-24', '2026-09-25', false],
    ['2026-09-27', '2026-10-01', false],
]);

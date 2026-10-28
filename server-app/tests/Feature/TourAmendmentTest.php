<?php

use App\Events\BookingLifecycleNotification;
use App\Models\Customer;
use App\Models\Role;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourSchedule;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([BookingLifecycleNotification::class]);
    $this->admin = User::create(['name' => 'Amendment admin', 'email' => 'amend@example.com', 'password' => 'password']);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $this->admin->roles()->attach($role);
    $customer = Customer::create(['name' => 'Traveller', 'phone' => '9000077777']);
    $this->tour = Tour::create(['title' => 'Amendable tour', 'slug' => 'amendable-tour', 'price_per_person' => 1000, 'is_active' => true]);
    $this->source = TourSchedule::create(['tour_id' => $this->tour->id, 'departure_date' => now()->addWeek(), 'return_date' => now()->addWeek(), 'departure_time' => '09:00', 'departure_point' => 'Station', 'total_seats' => 10, 'reserved_seats' => 2, 'booked_seats' => 0, 'status' => 'open']);
    $this->target = TourSchedule::create(['tour_id' => $this->tour->id, 'departure_date' => now()->addWeeks(2), 'return_date' => now()->addWeeks(2), 'departure_time' => '10:00', 'departure_point' => 'Hotel', 'total_seats' => 10, 'reserved_seats' => 0, 'booked_seats' => 0, 'price_override' => 5000, 'status' => 'open']);
    $this->booking = TourBooking::create(['customer_id' => $customer->id, 'tour_id' => $this->tour->id, 'tour_schedule_id' => $this->source->id, 'number_of_adults' => 2, 'number_of_children' => 0, 'travel_date' => $this->source->departure_date, 'customer_name' => $customer->name, 'customer_phone' => $customer->phone, 'price_per_adult' => 1000, 'subtotal' => 2000, 'total_price' => 2000, 'status' => 'pending', 'payment_status' => 'pending', 'payment_method' => 'cash', 'hold_expires_at' => now()->addMinutes(30)]);
    $this->url = '/admin/tour-bookings/'.$this->booking->id.'/amend-departure';
    $this->payload = ['source_schedule_id' => $this->source->id, 'target_schedule_id' => $this->target->id, 'reason' => 'Customer agreed by phone, case 123', 'customer_agreed' => true, 'request_id' => (string) \Illuminate\Support\Str::uuid()];
});

it('moves held or booked seats while preserving price payment and expiry snapshots', function (string $status, string $payment) {
    $this->booking->update(['status' => $status, 'payment_status' => $payment]);
    $column = $status === 'pending' ? 'reserved_seats' : 'booked_seats';
    $this->source->update(['reserved_seats' => $status === 'pending' ? 2 : 0, 'booked_seats' => $status === 'pending' ? 0 : 2]);
    $expiry = $this->booking->hold_expires_at->toIso8601String();
    $this->actingAs($this->admin)->postJson($this->url, $this->payload)->assertOk();
    $booking = $this->booking->fresh();
    expect((int) $booking->tour_schedule_id)->toBe($this->target->id);
    expect($booking->travel_date->toDateString())->toBe($this->target->departure_date->toDateString());
    expect($booking->total_price)->toBe('2000.00')->and($booking->price_per_adult)->toBe('1000.00');
    expect($booking->payment_status)->toBe($payment)->and($booking->status)->toBe($status);
    expect($booking->hold_expires_at->toIso8601String())->toBe($expiry);
    expect((int) $this->source->fresh()->{$column})->toBe(0);
    expect((int) $this->target->fresh()->{$column})->toBe(2);
    expect($booking->auditLogs()->first()->admin_id)->toBe($this->admin->id);
    Event::assertDispatched(BookingLifecycleNotification::class, fn ($event) => $event->action === 'booking.departure_amended');
    $this->postJson($this->url, $this->payload)->assertOk();
    $this->postJson($this->url, array_merge($this->payload, ['request_id' => (string) \Illuminate\Support\Str::uuid()]))->assertUnprocessable();
    expect((int) $this->target->fresh()->{$column})->toBe(2);
    expect($booking->auditLogs()->count())->toBe(1);
    $this->deleteJson('/admin/tours/'.$this->tour->id.'/schedules/'.$this->source->id)->assertUnprocessable();
    $this->deleteJson('/admin/tours/'.$this->tour->id)->assertUnprocessable();
})->with([['pending', 'pending'], ['confirmed', 'paid'], ['confirmed', 'partial']]);

it('rejects unsafe target departures without releasing the original seats', function (string $case) {
    match ($case) {
        'full' => $this->target->update(['booked_seats' => 9]),
        'closed' => $this->target->update(['status' => 'closed']),
        'past' => $this->target->update(['departure_date' => now()->subDay()]),
        'foreign' => $this->target->update(['tour_id' => Tour::create(['title' => 'Other', 'slug' => 'other', 'price_per_person' => 1000])->id]),
    };
    $this->actingAs($this->admin)->postJson($this->url, $this->payload)->assertUnprocessable();
    expect((int) $this->booking->fresh()->tour_schedule_id)->toBe($this->source->id);
    expect((int) $this->source->fresh()->reserved_seats)->toBe(2);
    expect($this->booking->auditLogs()->count())->toBe(0);
    Event::assertNotDispatched(BookingLifecycleNotification::class);
})->with(['full', 'closed', 'past', 'foreign']);

it('rejects expired started cancelled refunded and checked-in bookings', function (string $case) {
    match ($case) {
        'expired' => $this->booking->update(['hold_expires_at' => now()->subSecond()]),
        'started' => $this->booking->update(['status' => 'in_progress']),
        'cancelled' => $this->booking->update(['status' => 'cancelled']),
        'refunded' => $this->booking->update(['payment_status' => 'refunded']),
        'checked-in' => $this->booking->auditLogs()->create(['action' => 'customer.checkin.completed']),
    };
    $this->actingAs($this->admin)->postJson($this->url, $this->payload)->assertUnprocessable();
    expect((int) $this->booking->fresh()->tour_schedule_id)->toBe($this->source->id);
    expect((int) $this->target->fresh()->reserved_seats)->toBe(0);
})->with(['expired', 'started', 'cancelled', 'refunded', 'checked-in']);

it('requires admin access a reason and recorded customer agreement', function () {
    $this->postJson($this->url, $this->payload)->assertUnauthorized();
    $ordinary = User::create(['name' => 'Ordinary', 'email' => 'ordinary@example.com', 'password' => 'password']);
    $this->actingAs($ordinary)->postJson($this->url, $this->payload)->assertForbidden();
    $this->actingAs($this->admin)->postJson($this->url, array_merge($this->payload, ['customer_agreed' => false, 'reason' => '']))
        ->assertUnprocessable()->assertJsonValidationErrors(['customer_agreed', 'reason']);
});

it('retains distinct notifications for successive amendments but deduplicates job retries', function () {
    $this->booking->update(['sms_notification' => true, 'whatsapp_notification' => false, 'email_notification' => false]);
    $this->actingAs($this->admin)->postJson($this->url, $this->payload)->assertOk();
    $this->postJson($this->url, array_merge($this->payload, [
        'source_schedule_id' => $this->target->id, 'target_schedule_id' => $this->source->id,
        'request_id' => (string) \Illuminate\Support\Str::uuid(),
    ]))->assertOk();
    $this->postJson($this->url, $this->payload)->assertOk();
    expect((int) $this->booking->fresh()->tour_schedule_id)->toBe($this->source->id);
    foreach (Event::dispatched(BookingLifecycleNotification::class) as [$event]) {
        $job = new \App\Jobs\SendBookingLifecycleNotification($event->bookingType, $event->bookingId, $event->action, $event->metadata);
        $job->handle(app(\App\Services\NotificationService::class));
        $job->handle(app(\App\Services\NotificationService::class));
    }
    $messages = \App\Models\OutboxMessage::orderBy('id')->get();
    expect($messages)->toHaveCount(2);
    expect($messages[0]->body)->toContain($this->target->departure_date->toDateString());
    expect($messages[1]->body)->toContain($this->source->departure_date->toDateString());
});

it('requires and audits a schedule change reason while rejecting destructive edits', function () {
    $this->source->update(['departure_date' => $this->source->departure_date->toDateString(),
        'return_date' => $this->source->return_date->toDateString(), 'departure_time' => '09:00:00']);
    $url = '/admin/tours/'.$this->tour->id.'/schedules/'.$this->source->id;
    $payload = [
        'departure_date' => $this->source->departure_date->toDateString(),
        'return_date' => $this->source->return_date->toDateString(),
        'departure_time' => '09:00', 'departure_point' => 'Station', 'total_seats' => 12,
        'status' => 'open', 'price_override' => null, 'child_price_override' => null,
    ];
    $this->actingAs($this->admin)->putJson($url, $payload)->assertUnprocessable()->assertJsonValidationErrors('amendment_reason');
    $payload['amendment_reason'] = 'Additional capacity approved by operations';
    $this->putJson($url, $payload)->assertRedirect();
    expect((int) $this->source->fresh()->total_seats)->toBe(12);
    $audit = $this->source->auditLogs()->where('action', 'schedule.updated')->firstOrFail();
    expect($audit->admin_id)->toBe($this->admin->id)->and($audit->note)->toBe($payload['amendment_reason']);
    expect((int) $audit->before['total_seats'])->toBe(10)->and((int) $audit->after['total_seats'])->toBe(12);
    $this->putJson($url, array_merge($payload, ['total_seats' => 1]))->assertUnprocessable()->assertJsonValidationErrors('total_seats');
    $this->putJson($url, array_merge($payload, ['departure_point' => 'Different pickup']))->assertUnprocessable()->assertJsonValidationErrors('schedule');
    expect($this->source->fresh()->departure_point)->toBe('Station');
    expect($this->source->auditLogs()->count())->toBe(1);
});

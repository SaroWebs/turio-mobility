<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourSchedule;
use App\Services\TourAttendanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TourAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private function createBooking(array $attrs = []): TourBooking
    {
        $customer = Customer::firstOrCreate(['phone' => '919000000000'], ['name' => 'Test Cust']);
        $tour = Tour::firstOrCreate(['slug' => 'test-tour'], ['title' => 'Test tour', 'price_per_person' => 1000, 'duration_days' => 1, 'is_active' => true]);
        $schedule = TourSchedule::firstOrCreate(['tour_id' => $tour->id, 'departure_date' => now()->toDateString()], [
            'return_date' => now()->addDay()->toDateString(),
            'status' => 'open',
            'total_seats' => 10,
        ]);

        return TourBooking::create(array_merge([
            'booking_number' => \Illuminate\Support\Str::random(10),
            'customer_id' => $customer->id,
            'customer_name' => $customer->name,
            'customer_phone' => $customer->phone,
            'customer_email' => 'test@example.com',
            'tour_id' => $tour->id,
            'tour_schedule_id' => $schedule->id,
            'travel_date' => now()->toDateString(),
            'number_of_adults' => 1,
            'number_of_children' => 0,
            'total_price' => 1000,
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'payment_method' => 'card',
        ], $attrs));
    }

    public function test_waiting_period_starts_correctly()
    {
        $booking = $this->createBooking(['status' => 'confirmed']);
        $service = app(TourAttendanceService::class);

        \App\Models\Setting::updateOrCreate(['key' => 'tour.attendance.waiting_minutes'], ['value' => '15']);
        \App\Models\Setting::updateOrCreate(['key' => 'tour.attendance.trigger'], ['value' => 'scheduled_departure']);
        $booking->schedule->update(['departure_at' => now()->subMinute()]);
        $service->startWaiting($booking);

        $this->assertEquals('waiting', $booking->fresh()->attendance_status);
        $this->assertNotNull($booking->fresh()->waiting_started_at);
        $this->assertNotNull($booking->fresh()->waiting_deadline_at);
        $this->assertDatabaseHas('booking_audit_logs', [
            'auditable_type' => TourBooking::class,
            'auditable_id' => $booking->id,
            'action' => 'attendance.waiting_started',
        ]);
    }

    public function test_customer_joins_within_waiting_period_succeeds()
    {
        $booking = $this->createBooking(['status' => 'confirmed', 'attendance_status' => 'waiting', 'waiting_deadline_at' => now()->subMinute()]);
        $service = app(TourAttendanceService::class);

        $booking->auditLogs()->create(['action' => 'operator.start_pin.verified']);
        $service->markJoined($booking);

        $this->assertEquals('joined', $booking->fresh()->attendance_status);
        $this->assertNotNull($booking->fresh()->joined_at);
        $this->assertNull($booking->fresh()->waiting_deadline_at);
    }

    public function test_no_show_can_be_marked_after_waiting_period()
    {
        $booking = $this->createBooking(['status' => 'confirmed', 'attendance_status' => 'waiting', 'waiting_deadline_at' => now()->subMinute()]);
        $service = app(TourAttendanceService::class);

        $service->markNoShow($booking, 'driver', 'Did not show up');

        $this->assertEquals('no_show', $booking->fresh()->attendance_status);
        $this->assertEquals('pending_review', $booking->fresh()->no_show_review_status);
    }

    public function test_no_show_does_not_auto_cancel_booking()
    {
        $booking = $this->createBooking(['status' => 'confirmed', 'attendance_status' => 'waiting', 'waiting_deadline_at' => now()->subMinute()]);
        $service = app(TourAttendanceService::class);

        $service->markNoShow($booking, 'driver', 'Did not show up');

        // Status remains unchanged
        $this->assertEquals('confirmed', $booking->fresh()->status);
    }

    public function test_admin_can_review_no_show_confirmed()
    {
        $booking = $this->createBooking([
            'status' => 'confirmed',
            'attendance_status' => 'no_show',
            'no_show_review_status' => 'pending_review',
        ]);
        $service = app(TourAttendanceService::class);

        $service->reviewNoShow($booking, 'confirmed', 'Approved');

        $this->assertEquals('confirmed', $booking->fresh()->no_show_review_status);
        $this->assertEquals('no_show', $booking->fresh()->attendance_status);
    }

    public function test_admin_can_review_no_show_excused()
    {
        $booking = $this->createBooking([
            'status' => 'confirmed',
            'attendance_status' => 'no_show',
            'no_show_review_status' => 'pending_review',
        ]);
        $service = app(TourAttendanceService::class);

        $service->reviewNoShow($booking, 'excused', 'Valid reason');

        $this->assertEquals('excused', $booking->fresh()->no_show_review_status);
        $this->assertEquals('excused', $booking->fresh()->attendance_status);
    }

    public function test_cannot_mark_no_show_before_deadline()
    {
        $booking = $this->createBooking(['attendance_status' => 'waiting', 'waiting_deadline_at' => now()->addMinute()]);
        $this->expectException(\Exception::class);
        app(TourAttendanceService::class)->markNoShow($booking, 'driver');
    }

    public function test_missing_policy_does_not_start_waiting()
    {
        $booking = $this->createBooking();
        app(TourAttendanceService::class)->startWaiting($booking);
        $this->assertNull($booking->fresh()->attendance_status);
    }
}

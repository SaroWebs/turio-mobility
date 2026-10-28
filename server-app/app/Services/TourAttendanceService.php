<?php

namespace App\Services;

use App\Models\TourBooking;

class TourAttendanceService
{
    /**
     * Start the attendance waiting period for a booking.
     * Called when departure time arrives or driver initiates departure.
     */
    public function startWaiting(TourBooking $booking): void
    {
        \Illuminate\Support\Facades\DB::transaction(function () use ($booking) {
            $booking = TourBooking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if (! in_array($booking->status, ['confirmed'], true)) {
                return;
            }

            if ($booking->attendance_status === 'waiting') {
                return;
            }

            $waitingMinutes = filter_var(setting('tour.attendance.waiting_minutes'), FILTER_VALIDATE_INT);
            $departure = $booking->schedule?->departure_at;
            if (! $waitingMinutes || $waitingMinutes < 1 || setting('tour.attendance.trigger') !== 'scheduled_departure'
                || ! $departure || $departure->isFuture() || $booking->attendance_status !== null) {
                return;
            }

            $booking->update([
                'attendance_status' => 'waiting',
                'waiting_started_at' => $departure,
                'waiting_deadline_at' => $departure->copy()->addMinutes($waitingMinutes),
            ]);

            $booking->auditLogs()->create([
                'action' => 'attendance.waiting_started',
                'note' => 'system',
                'after' => ['message' => "Attendance waiting period started for {$waitingMinutes} minutes."],
            ]);
        });
    }

    /**
     * Mark a customer as joined (they showed up and started the tour).
     */
    public function markJoined(TourBooking $booking): void
    {
        \Illuminate\Support\Facades\DB::transaction(function () use ($booking) {
            $booking = TourBooking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($booking->status, ['confirmed', 'in_progress'], true), 422);
            if ($booking->attendance_status === 'joined') {
                return;
            }
            abort_unless($booking->auditLogs()->where('action', 'operator.start_pin.verified')->exists(), 422, 'Verify the customer start code first.');
            $booking->update([
                'attendance_status' => 'joined',
                'joined_at' => now(),
                'waiting_deadline_at' => null,
            ]);

            $booking->auditLogs()->create([
                'action' => 'attendance.joined',
                'note' => 'driver', // Default to driver as they verify the pin
                'after' => ['message' => 'Customer joined the tour.'],
            ]);
        });
    }

    /**
     * Mark a customer as no-show after waiting period expires.
     * Does NOT auto-forfeit deposits or process refunds.
     */
    public function markNoShow(TourBooking $booking, string $markedBy, ?string $reason = null): void
    {
        \Illuminate\Support\Facades\DB::transaction(function () use ($booking, $markedBy, $reason) {
            $booking = TourBooking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if ($booking->status !== 'confirmed' || $booking->attendance_status !== 'waiting' || ! $booking->waiting_deadline_at || $booking->waiting_deadline_at->isFuture()) {
                throw new \Exception('The attendance waiting deadline has not elapsed.');
            }

            $booking->update([
                'attendance_status' => 'no_show',
                'no_show_at' => now(),
                'no_show_marked_by' => $markedBy,
                'no_show_review_status' => 'pending_review',
            ]);

            $booking->auditLogs()->create([
                'action' => 'attendance.no_show',
                'note' => $markedBy,
                'after' => ['message' => 'Customer marked as no-show.'.($reason ? " Reason: {$reason}" : '')],
            ]);

            // Emit notification for admin review
            app(BookingLifecycleNotifier::class)->emit($booking, 'attendance.no_show_reported', [
                'reason' => $reason,
                'marked_by' => $markedBy,
            ]);
        });
    }

    /**
     * Admin reviews a no-show and decides the outcome.
     */
    public function reviewNoShow(TourBooking $booking, string $decision, ?string $notes = null): void
    {
        \Illuminate\Support\Facades\DB::transaction(function () use ($booking, $decision, $notes) {
            $booking = TourBooking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if ($booking->attendance_status !== 'no_show') {
                throw new \Exception('Can only review no-show bookings.');
            }

            if (! in_array($decision, ['confirmed', 'excused'], true)) {
                throw new \InvalidArgumentException('Decision must be confirmed or excused.');
            }

            $update = [
                'no_show_review_status' => $decision,
            ];

            if ($decision === 'excused') {
                $update['attendance_status'] = 'excused';
            }

            $booking->update($update);

            $booking->auditLogs()->create([
                'action' => 'attendance.no_show_reviewed',
                'note' => 'admin',
                'after' => ['message' => "No-show reviewed and {$decision}.".($notes ? " Notes: {$notes}" : '')],
            ]);
        });
    }
}

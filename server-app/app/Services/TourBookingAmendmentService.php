<?php

namespace App\Services;

use App\Models\TourBooking;
use App\Models\TourSchedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TourBookingAmendmentService
{
    public function transfer(TourBooking $booking, int $sourceId, int $targetId, string $reason, int $adminId, string $requestId): void
    {
        DB::transaction(function () use ($booking, $sourceId, $targetId, $reason, $adminId, $requestId) {
            $booking = TourBooking::lockForUpdate()->findOrFail($booking->id);
            $previous = $booking->auditLogs()->where('action', 'booking.departure_amended')
                ->where('after->request_id', $requestId)->first();
            if ($previous) {
                if ((int) $previous->before['tour_schedule_id'] !== $sourceId
                    || (int) $previous->after['tour_schedule_id'] !== $targetId) {
                    $this->reject('This amendment reference has already been used for a different change.');
                }

                return;
            }
            if (trim($reason) === '' || $sourceId === $targetId) {
                $this->reject('Choose a different departure and provide an amendment reason.');
            }
            // Expected source rejects stale forms; the request reference handles retries.
            if ((int) $booking->tour_schedule_id !== $sourceId) {
                $this->reject('The booking departure changed. Refresh before making another amendment.');
            }
            if (! in_array($booking->status, ['pending', 'confirmed'], true)
                || $booking->payment_status === 'refunded'
                || $booking->refunds()->where('status', 'pending')->exists()
                || ($booking->status === 'pending' && (! $booking->hold_expires_at || $booking->hold_expires_at->lte(now())))) {
                $this->reject('Only an unexpired pending or confirmed booking without a refund under review can be moved.');
            }
            if ($booking->assigned_driver_id || $booking->assigned_guide_id || $booking->assigned_vehicle_id
                || $booking->travelStatuses()->exists() || app(StartVerificationService::class)->isVerified($booking)) {
                $this->reject('Resolve direct operator assignments or check-in before requesting an amendment.');
            }
            $schedules = TourSchedule::whereIn('id', [$sourceId, $targetId])->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $source = $schedules->get($sourceId);
            $target = $schedules->get($targetId);
            if (! $source || ! $target || (int) $source->tour_id !== (int) $booking->tour_id
                || (int) $target->tour_id !== (int) $booking->tour_id) {
                $this->reject('Both departures must belong to the booked tour.');
            }
            if ($source->status === 'completed' || ! $source->departure_at || $source->departure_at->lte(now())
                || ! TourSchedule::whereKey($targetId)->bookable($booking->getTotalPax())->exists()) {
                $this->reject('Select an open future departure with enough seats before the original departure starts.');
            }
            $column = $booking->status === 'pending' ? 'reserved_seats' : 'booked_seats';
            $seats = $booking->getTotalPax();
            if ((int) $source->{$column} < $seats) {
                $this->reject('Source seat inventory needs reconciliation before this booking can be moved.');
            }
            $before = ['tour_schedule_id' => $sourceId, 'travel_date' => $booking->travel_date->toDateString()];
            $source->decrement($column, $seats);
            $target->increment($column, $seats);
            $booking->update(['tour_schedule_id' => $targetId, 'travel_date' => $target->departure_date]);
            $audit = [
                'admin_id' => $adminId, 'action' => 'booking.departure_amended', 'before' => $before,
                'after' => ['tour_schedule_id' => $targetId, 'travel_date' => $target->departure_date->toDateString(),
                    'booking_id' => $booking->id, 'request_id' => $requestId, 'customer_agreed' => true, 'total_price' => $booking->total_price],
                'note' => trim($reason),
            ];
            $bookingAudit = $booking->auditLogs()->create($audit);
            // Keep the former departure's history protected after its last booking moves away.
            $source->auditLogs()->create($audit);
            $target->auditLogs()->create($audit);
            app(BookingLifecycleNotifier::class)->emit($booking, 'booking.departure_amended', [
                'previous_schedule_id' => $sourceId, 'schedule_id' => $targetId,
                'travel_date' => $target->departure_date->toDateString(),
                'amendment_id' => $bookingAudit->id,
            ]);
        });
    }

    private function reject(string $message): never
    {
        throw ValidationException::withMessages(['amendment' => $message]);
    }
}

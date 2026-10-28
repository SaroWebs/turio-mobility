<?php

namespace App\Services;

use App\Models\CarRental;
use App\Models\RideBooking;
use App\Models\SharedTrip;
use App\Models\TourDriverAssignment;

class PoolingSchedule
{
    public function __construct(private ResourceCommitmentService $commitments, private PoolingRouter $router) {}

    /** Snapshot future commitments so road calculations can run before acquiring locks. */
    public function snapshot(SharedTrip $trip): array
    {
        $resource = function ($q) use ($trip) {
            $q->where('driver_id', $trip->driver_id)->orWhere('vehicle_id', $trip->vehicle_id);
        };
        $rows = [];
        foreach (RideBooking::where($resource)->whereIn('status', ['pending', 'confirmed', ...SharedTripService::ACTIVE])
            ->where(fn ($q) => $q->whereNull('shared_trip_id')->orWhere('shared_trip_id', '!=', $trip->id))
            ->where('scheduled_at', '>', now())->orderBy('id')->get() as $ride) {
            $rows[] = ['key' => 'ride:'.$ride->id, 'start' => $ride->scheduled_at->timestamp, 'lat' => $ride->pickup_lat, 'lng' => $ride->pickup_lng];
        }
        foreach (CarRental::where($resource)->whereIn('status', ['pending', 'confirmed', 'driver_assigned', 'in_progress'])
            ->whereDate('end_date', '>=', today())->orderBy('id')->get() as $rental) {
            if ($rental->hold_expires_at?->lte(now()) && $rental->payment_status !== 'paid') {
                continue;
            }
            $start = $this->commitments->getRentalInterval($rental)['start']->timestamp;
            if ($start > now()->timestamp) {
                $rows[] = ['key' => 'rental:'.$rental->id, 'start' => $start, 'lat' => $rental->pickup_lat, 'lng' => $rental->pickup_lng];
            }
        }
        foreach (TourDriverAssignment::with('schedule')->where($resource)->whereIn('status', ['assigned', 'accepted'])
            ->whereHas('schedule', fn ($q) => $q->whereNotIn('status', ['cancelled', 'completed'])->whereDate('departure_date', '>=', today()))->orderBy('id')->get() as $assignment) {
            $start = $this->commitments->getTourInterval($assignment->schedule)['start']->timestamp;
            if ($start > now()->timestamp) {
                $rows[] = ['key' => 'tour:'.$assignment->id, 'start' => $start, 'lat' => null, 'lng' => null];
            }
        }

        return $rows;
    }

    public function permits(array $snapshot, array $plan): bool
    {
        $last = $plan['stops'][count($plan['stops']) - 1];
        foreach ($snapshot as $next) {
            // Legacy tours have text-only departure points. Do not promise a same-day transfer we cannot route.
            if ($next['lat'] === null || $next['lng'] === null) {
                if ($next['start'] < $plan['ends_at'] + 86400) {
                    return false;
                }

                continue;
            }
            $transfer = $this->router->leg($last, ['lat' => (float) $next['lat'], 'lng' => (float) $next['lng']]);
            if (! $transfer || $next['start'] < $plan['ends_at'] + $transfer['seconds'] + config('pooling.schedule_buffer_seconds')) {
                return false;
            }
        }

        return true;
    }
}

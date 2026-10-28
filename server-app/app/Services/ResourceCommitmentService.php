<?php

namespace App\Services;

use App\Models\CarRental;
use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\TourDriverAssignment;
use App\Models\TourSchedule;
use App\Models\Vehicle;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class ResourceCommitmentService
{
    /**
     * Deterministically locks resources in (resource_type, resource_id) ascending order
     * to eliminate lock-inversion deadlocks between concurrent assignment writers.
     *
     * @return array{driver: ?Driver, vehicle: ?Vehicle}
     */
    public function lockResources(?int $driverId, ?int $vehicleId): array
    {
        $resources = [];

        if ($driverId) {
            $resources[] = ['type' => 'driver', 'id' => (int) $driverId];
        }

        if ($vehicleId) {
            $resources[] = ['type' => 'vehicle', 'id' => (int) $vehicleId];
        }

        // Sort ascending by type then id for strict global total ordering
        usort($resources, function (array $a, array $b) {
            $typeCmp = strcmp($a['type'], $b['type']);
            if ($typeCmp !== 0) {
                return $typeCmp;
            }

            return $a['id'] <=> $b['id'];
        });

        $lockedDriver = null;
        $lockedVehicle = null;

        foreach ($resources as $resource) {
            if ($resource['type'] === 'driver') {
                $lockedDriver = Driver::whereKey($resource['id'])->lockForUpdate()->first();
            } elseif ($resource['type'] === 'vehicle') {
                $lockedVehicle = Vehicle::whereKey($resource['id'])->lockForUpdate()->first();
            }
        }

        return [
            'driver' => $lockedDriver,
            'vehicle' => $lockedVehicle,
        ];
    }

    /**
     * Normalized interval calculation for a RideBooking (start to end + turnaround buffer).
     *
     * @return array{start: Carbon, end: Carbon}
     */
    public function getRideInterval(RideBooking $ride): array
    {
        $durationMinutes = max(30, (int) ($ride->estimated_duration ?: 30));
        $bufferMinutes = (int) setting('ride.dispatch.turnaround_buffer_minutes', 15);
        $totalMinutes = $durationMinutes + $bufferMinutes;

        if (in_array($ride->status, ['driver_arriving', 'pickup', 'in_transit'], true)) {
            $start = $ride->started_at
                ? Carbon::parse($ride->started_at)->utc()
                : ($ride->scheduled_at ? Carbon::parse($ride->scheduled_at)->utc() : now()->utc());
            $end = max(now()->utc()->addMinutes(15), $start->copy()->addMinutes($totalMinutes));

            return ['start' => $start, 'end' => $end];
        }

        $start = $ride->scheduled_at
            ? Carbon::parse($ride->scheduled_at)->utc()
            : ($ride->created_at ? Carbon::parse($ride->created_at)->utc() : now()->utc());
        $end = $start->copy()->addMinutes($totalMinutes);

        return ['start' => $start, 'end' => $end];
    }

    /**
     * Normalized interval calculation for a TourSchedule.
     *
     * @return array{start: Carbon, end: Carbon}
     */
    public function getTourInterval(TourSchedule $schedule): array
    {
        $businessTz = config('app.business_timezone', 'Asia/Kolkata');
        $depDate = $schedule->departure_date ? Carbon::parse($schedule->departure_date)->toDateString() : today()->toDateString();
        $depTime = $schedule->departure_time ?: '00:00:00';
        $start = $schedule->departure_at
            ? Carbon::parse($schedule->departure_at)->utc()
            : Carbon::parse("{$depDate} {$depTime}", $businessTz)->utc();

        $retDate = $schedule->return_date ? Carbon::parse($schedule->return_date)->toDateString() : $depDate;
        $end = Carbon::parse("{$retDate} 23:59:59", $businessTz)->utc();

        return ['start' => $start, 'end' => $end];
    }

    /**
     * Normalized interval calculation for a CarRental.
     *
     * @return array{start: Carbon, end: Carbon}
     */
    public function getRentalInterval(CarRental $rental): array
    {
        $businessTz = config('app.business_timezone', 'Asia/Kolkata');
        $sDate = Carbon::parse($rental->start_date)->toDateString();
        $eDate = Carbon::parse($rental->end_date)->toDateString();
        $sTime = $rental->start_time ?: '00:00:00';
        $eTime = $rental->end_time ?: '23:59:59';

        $start = Carbon::parse("{$sDate} {$sTime}", $businessTz)->utc();
        $end = Carbon::parse("{$eDate} {$eTime}", $businessTz)->utc();

        return ['start' => $start, 'end' => $end];
    }

    /**
     * Standard open-interval intersection predicate: [S1, E1] overlaps [S2, E2] iff S1 < E2 and E1 > S2.
     */
    public function intervalsOverlap(Carbon $startA, Carbon $endA, Carbon $startB, Carbon $endB): bool
    {
        return $startA->lt($endB) && $endA->gt($startB);
    }

    /**
     * Find all cross-service commitment conflicts for the given driver and/or vehicle
     * across Tours, Car Rentals, and Rides during the specified date range or interval.
     *
     * @param  array{
     *     exact_interval?: bool,
     *     exclude_tour_assignment_id?: ?int,
     *     exclude_tour_schedule_id?: ?int,
     *     exclude_car_rental_id?: ?int,
     *     exclude_ride_booking_id?: ?int,
     * }  $options
     * @return array<int, string>
     */
    public function findConflicts(
        ?int $driverId,
        ?int $vehicleId,
        Carbon|string $startDate,
        Carbon|string $endDate,
        array $options = []
    ): array {
        if (! $driverId && ! $vehicleId) {
            return [];
        }

        $businessTz = config('app.business_timezone', 'Asia/Kolkata');
        $isExact = ! empty($options['exact_interval']);

        if ($isExact) {
            $qStart = Carbon::parse($startDate)->utc();
            $qEnd = Carbon::parse($endDate)->utc();
            $startStr = $qStart->copy()->timezone($businessTz)->toDateString();
            $endStr = $qEnd->copy()->timezone($businessTz)->toDateString();
        } else {
            $startStr = Carbon::parse($startDate)->toDateString();
            $endStr = Carbon::parse($endDate)->toDateString();
            $qStart = Carbon::parse($startStr.' 00:00:00', $businessTz)->utc();
            $qEnd = Carbon::parse($endStr.' 23:59:59', $businessTz)->utc();
        }

        $conflicts = [];

        $sharedTrips = \App\Models\SharedTrip::whereHas('bookings', fn ($q) => $q->whereIn('status', \App\Services\SharedTripService::ACTIVE))
            ->where(function ($q) use ($driverId, $vehicleId) {
                if ($driverId) {
                    $q->where('driver_id', $driverId);
                }
                if ($vehicleId) {
                    $q->orWhere('vehicle_id', $vehicleId);
                }
            })->when($options['exclude_shared_trip_id'] ?? null, fn ($q, $id) => $q->whereKeyNot($id))->get();
        foreach ($sharedTrips as $trip) {
            $end = max(now()->addMinutes(15), $trip->ends_at->copy()->addSeconds(config('pooling.schedule_buffer_seconds')));
            if ($this->intervalsOverlap($qStart, $qEnd, $trip->created_at, $end)) {
                $conflicts[] = "Conflicting shared trip #{$trip->id}.";
            }
        }

        // 1. Tour Commitments (TourDriverAssignment with non-cancelled schedule)
        $tourAssignments = TourDriverAssignment::query()
            ->with(['schedule.tour', 'driver', 'vehicle'])
            ->whereIn('status', ['assigned', 'accepted'])
            ->where(function (Builder $query) use ($driverId, $vehicleId) {
                $query->where(function (Builder $q) use ($driverId, $vehicleId) {
                    if ($driverId && $vehicleId) {
                        $q->where('driver_id', $driverId)->orWhere('vehicle_id', $vehicleId);
                    } elseif ($driverId) {
                        $q->where('driver_id', $driverId);
                    } else {
                        $q->where('vehicle_id', $vehicleId);
                    }
                });
            })
            ->whereHas('schedule', function (Builder $scheduleQuery) use ($startStr, $endStr, $options) {
                $scheduleQuery->where('status', '!=', 'cancelled')
                    ->whereDate('departure_date', '<=', $endStr)
                    ->where(function (Builder $q) use ($startStr) {
                        $q->whereDate('return_date', '>=', $startStr)
                            ->orWhere(function (Builder $sub) use ($startStr) {
                                $sub->whereNull('return_date')
                                    ->whereDate('departure_date', '>=', $startStr);
                            });
                    });

                if (! empty($options['exclude_tour_schedule_id'])) {
                    $scheduleQuery->whereKeyNot($options['exclude_tour_schedule_id']);
                }
            })
            ->when(! empty($options['exclude_tour_assignment_id']), function (Builder $q) use ($options) {
                $q->whereKeyNot($options['exclude_tour_assignment_id']);
            })
            ->get();

        foreach ($tourAssignments as $assignment) {
            $schedule = $assignment->schedule;
            if (! $schedule) {
                continue;
            }

            $tourInterval = $this->getTourInterval($schedule);
            if (! $this->intervalsOverlap($qStart, $qEnd, $tourInterval['start'], $tourInterval['end'])) {
                continue;
            }

            $matchedResource = [];
            if ($driverId && (int) $assignment->driver_id === (int) $driverId) {
                $matchedResource[] = 'Driver';
            }
            if ($vehicleId && (int) $assignment->vehicle_id === (int) $vehicleId) {
                $matchedResource[] = 'Vehicle';
            }
            $resourceLabel = implode(' and ', $matchedResource);
            $tourTitle = $schedule?->tour?->title ?? 'Tour';
            $dep = $schedule?->departure_date ? Carbon::parse($schedule->departure_date)->toDateString() : 'N/A';
            $ret = $schedule?->return_date ? Carbon::parse($schedule->return_date)->toDateString() : $dep;

            $conflicts[] = "{$resourceLabel} is already committed to tour '{$tourTitle}' (departure #{$schedule?->id} from {$dep} to {$ret}).";
        }

        // 2. Car Rental Commitments
        $rentals = CarRental::query()
            ->with(['carCategory', 'driver', 'vehicle'])
            ->whereIn('status', ['pending', 'confirmed', 'driver_assigned', 'in_progress'])
            ->where(function (Builder $query) use ($driverId, $vehicleId) {
                if ($driverId && $vehicleId) {
                    $query->where('driver_id', $driverId)->orWhere('vehicle_id', $vehicleId);
                } elseif ($driverId) {
                    $query->where('driver_id', $driverId);
                } else {
                    $query->where('vehicle_id', $vehicleId);
                }
            })
            ->whereDate('start_date', '<=', $endStr)
            ->whereDate('end_date', '>=', $startStr)
            ->when(! empty($options['exclude_car_rental_id']), function (Builder $q) use ($options) {
                $q->whereKeyNot($options['exclude_car_rental_id']);
            })
            ->where(function (Builder $q) {
                $q->whereNull('hold_expires_at')
                    ->orWhere('hold_expires_at', '>', now())
                    ->orWhere('payment_status', 'paid');
            })
            ->get();

        foreach ($rentals as $rental) {
            $rentalInterval = $this->getRentalInterval($rental);
            if (! $this->intervalsOverlap($qStart, $qEnd, $rentalInterval['start'], $rentalInterval['end'])) {
                continue;
            }

            $matchedResource = [];
            if ($driverId && (int) $rental->driver_id === (int) $driverId) {
                $matchedResource[] = 'Driver';
            }
            if ($vehicleId && (int) $rental->vehicle_id === (int) $vehicleId) {
                $matchedResource[] = 'Vehicle';
            }
            $resourceLabel = implode(' and ', $matchedResource);
            $rStart = Carbon::parse($rental->start_date)->toDateString();
            $rEnd = Carbon::parse($rental->end_date)->toDateString();

            $conflicts[] = "{$resourceLabel} is already committed to rental booking #{$rental->booking_number} ({$rStart} to {$rEnd}).";
        }

        // 3. Fast Ride Commitments
        $rides = RideBooking::query()
            ->when($options['exclude_shared_trip_id'] ?? null, fn ($q, $id) => $q->where(fn ($q) => $q->whereNull('shared_trip_id')->orWhere('shared_trip_id', '!=', $id)))
            ->with(['driver', 'vehicle'])
            ->whereIn('status', ['pending', 'confirmed', 'driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
            ->where(function (Builder $query) use ($driverId, $vehicleId) {
                if ($driverId && $vehicleId) {
                    $query->where('driver_id', $driverId)->orWhere('vehicle_id', $vehicleId);
                } elseif ($driverId) {
                    $query->where('driver_id', $driverId);
                } else {
                    $query->where('vehicle_id', $vehicleId);
                }
            })
            ->where(function (Builder $query) use ($qStart, $qEnd) {
                $query->whereBetween('scheduled_at', [$qStart->copy()->subHours(24), $qEnd->copy()->addHours(24)])
                    ->orWhereIn('status', ['driver_arriving', 'pickup', 'in_transit'])
                    ->orWhere(fn ($sub) => $sub->whereNull('scheduled_at')->where('created_at', '>=', now()->subHours(24)));
            })
            ->when(! empty($options['exclude_ride_booking_id']), function (Builder $q) use ($options) {
                $q->whereKeyNot($options['exclude_ride_booking_id']);
            })
            ->get();

        foreach ($rides as $ride) {
            $rideInterval = $this->getRideInterval($ride);
            if (! $this->intervalsOverlap($qStart, $qEnd, $rideInterval['start'], $rideInterval['end'])) {
                continue;
            }

            $matchedResource = [];
            if ($driverId && (int) $ride->driver_id === (int) $driverId) {
                $matchedResource[] = 'Driver';
            }
            if ($vehicleId && (int) $ride->vehicle_id === (int) $vehicleId) {
                $matchedResource[] = 'Vehicle';
            }
            $resourceLabel = implode(' and ', $matchedResource);
            $rideTime = $ride->scheduled_at ? Carbon::parse($ride->scheduled_at)->toDateTimeString() : 'now';

            $conflicts[] = "{$resourceLabel} has a conflicting ride booking #{$ride->booking_number} ({$ride->status} at {$rideTime}).";
        }

        $carpools = \App\Models\CarpoolRide::whereIn('status', ['published', 'in_progress'])
            ->where('departure_at', '<', $qEnd)
            ->where('ends_at', '>', $qStart)
            ->where(function ($q) use ($driverId, $vehicleId) {
                if ($driverId) {
                    $q->where('driver_id', $driverId);
                }
                if ($vehicleId) {
                    $q->orWhere('vehicle_id', $vehicleId);
                }
            })
            ->when($options['exclude_carpool_ride_id'] ?? null, fn ($q, $id) => $q->whereKeyNot($id))->get();
        foreach ($carpools as $carpool) {
            $conflicts[] = "Conflicting carpool trip #{$carpool->id}.";
        }

        return $conflicts;
    }

    /**
     * Asserts that the driver and/or vehicle are available without conflicting commitments.
     *
     * @throws ValidationException
     */
    public function assertAvailable(
        ?int $driverId,
        ?int $vehicleId,
        Carbon|string $startDate,
        Carbon|string $endDate,
        array $options = []
    ): void {
        $conflicts = $this->findConflicts($driverId, $vehicleId, $startDate, $endDate, $options);

        if (! empty($conflicts)) {
            throw ValidationException::withMessages([
                'driver_id' => $conflicts,
            ]);
        }
    }
}

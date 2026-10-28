<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\RideBooking;
use App\Models\RideDispatchAttempt;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;

class DriverDispatchService
{
    public const DEFAULT_PICKUP_RADIUS_KM = 30.0;

    public function dispatchDueRides(): int
    {
        $count = 0;
        RideBooking::whereNull('driver_id')->whereIn('status', ['pending', 'confirmed'])
            ->where('scheduled_at', '<=', now()->addMinutes((int) setting('ride.dispatch.window_minutes', 15)))
            ->where(fn ($q) => $q->whereNull('request_expires_at')->orWhere('request_expires_at', '>', now()))
            ->whereDoesntHave('dispatchAttempts', fn ($q) => $q->where('status', 'offered')->where('expires_at', '>', now()))
            ->chunkById(100, function ($rides) use (&$count) {
                foreach ($rides as $ride) {
                    $count += DB::transaction(function () use ($ride) {
                        $ride = RideBooking::lockForUpdate()->find($ride->id);
                        if (! $ride || $ride->driver_id || ! in_array($ride->status, ['pending', 'confirmed'], true)
                            || $ride->request_expires_at?->isPast()
                            || $ride->dispatchAttempts()->where('status', 'offered')->where('expires_at', '>', now())->exists()) {
                            return 0;
                        }
                        if (! $ride->request_expires_at) {
                            $ride->update(['request_expires_at' => now()->addSeconds(RideRequestLifecycle::SEARCH_SECONDS)]);
                        }

                        $lastWave = (int) $ride->dispatchAttempts()->max('wave_number');
                        $waveNumber = $lastWave > 0 ? $lastWave + 1 : 1;

                        $baseRadius = (float) setting('ride.dispatch.pickup_radius_km', self::DEFAULT_PICKUP_RADIUS_KM, [
                            'lat' => (float) $ride->pickup_lat,
                            'lng' => (float) $ride->pickup_lng,
                        ]);
                        $expansionMultiplier = 1.0 + (($waveNumber - 1) * (float) setting('ride.dispatch.wave_radius_step_multiplier', 0.25));
                        $maxRadius = (float) setting('ride.dispatch.max_expanded_radius_km', 60.0);
                        $effectiveRadius = min($maxRadius, $baseRadius * $expansionMultiplier);

                        $attempted = $ride->dispatchAttempts()->pluck('driver_id');
                        $candidates = $this->rankedCandidates(
                            $this->rideServiceType($ride),
                            (float) $ride->pickup_lat,
                            (float) $ride->pickup_lng,
                            null,
                            1000,
                            $ride->car_category_id,
                            (bool) $ride->sharing_requested,
                            $effectiveRadius,
                            null,
                            $ride
                        )->reject(fn ($availability) => $attempted->contains($availability->driver_id))
                            ->take((int) setting('ride.dispatch.max_candidates', 10));

                        $this->createRideAttempts($ride, $candidates, null, $waveNumber);
                        $ride->update(['dispatch_status' => $candidates->isEmpty() ? 'admin_queue' : 'offered', 'admin_assignable' => $candidates->isEmpty()]);
                        if ($candidates->isNotEmpty()) {
                            $ids = $candidates->pluck('driver_id')->map(fn ($id) => (int) $id)->all();
                            DB::afterCommit(fn () => broadcast(new \App\Events\NewRideRequest($ride, $ids)));
                        }

                        return 1;
                    });
                }
            });

        return $count;
    }

    public function rankedCandidates(
        string $serviceType,
        float $pickupLat,
        float $pickupLng,
        ?string $role = null,
        ?int $limit = null,
        ?int $carCategoryId = null,
        bool $preferSharingEnabled = false,
        ?float $radiusKm = null,
        ?int $excludeTourAssignmentId = null,
        ?RideBooking $rideBooking = null
    ) {
        $limit ??= (int) setting('ride.dispatch.max_candidates', 10);

        $candidates = $this->nearbyAvailability($pickupLat, $pickupLng, $radiusKm)
            ->filter(function (DriverAvailability $availability) use ($serviceType, $role, $carCategoryId, $pickupLat, $pickupLng, $radiusKm, $excludeTourAssignmentId, $rideBooking) {
                $driver = $availability->driver;

                return $driver
                    && $this->eligibilityFailures(
                        $driver,
                        $serviceType,
                        $role,
                        $carCategoryId,
                        null,
                        $pickupLat,
                        $pickupLng,
                        $radiusKm,
                        $excludeTourAssignmentId,
                        $rideBooking
                    ) === [];
            });

        if (setting('ride.dispatch.fairness_scoring_enabled', false)) {
            $candidates = $this->scoreCandidates($candidates);
        } else {
            $candidates = $candidates->sortBy([
                // Keep existing pooling clients compatible; private Fast Ride uses distance only.
                fn ($a, $b) => ($preferSharingEnabled ? ((int) $b->sharing_enabled <=> (int) $a->sharing_enabled) : 0),
                fn ($a, $b) => (float) $a->distance <=> (float) $b->distance,
                fn ($a, $b) => $a->driver_id <=> $b->driver_id,
            ]);
        }

        return $candidates->take($limit)->values();
    }

    public function scoreCandidates($candidates)
    {
        if ($candidates->isEmpty()) {
            return collect([]);
        }

        $metrics = [];
        foreach ($candidates as $candidate) {
            $driver = $candidate->driver;
            $dist = (float) $candidate->distance;

            $lastRide = $driver->rideBookings()
                ->where('status', 'completed')
                ->orderBy('id', 'desc')
                ->first();
            $idleSeconds = $lastRide ? now()->diffInSeconds($lastRide->updated_at) : 99999999;
            $acceptanceRate = $this->acceptanceRate($driver);
            $rating = (float) ($driver->rating ?? 5.0);

            $metrics[] = [
                'candidate' => $candidate,
                'dist' => $dist,
                'idle' => $idleSeconds,
                'accept' => $acceptanceRate,
                'rating' => $rating,
            ];
        }

        $minDist = min(array_column($metrics, 'dist'));
        $maxDist = max(array_column($metrics, 'dist'));
        $minIdle = min(array_column($metrics, 'idle'));
        $maxIdle = max(array_column($metrics, 'idle'));
        $minAccept = min(array_column($metrics, 'accept'));
        $maxAccept = max(array_column($metrics, 'accept'));
        $minRating = min(array_column($metrics, 'rating'));
        $maxRating = max(array_column($metrics, 'rating'));

        $wDist = (float) setting('ride.dispatch.weight_distance_penalty', 2.0);
        $wIdle = (float) setting('ride.dispatch.weight_workload_penalty', 2.0);
        $wAccept = (float) setting('ride.dispatch.weight_acceptance', 10.0);
        $wRating = (float) setting('ride.dispatch.weight_rating', 10.0);

        foreach ($metrics as &$m) {
            $nDist = $maxDist > $minDist ? ($m['dist'] - $minDist) / ($maxDist - $minDist) : 0;
            $nIdle = $maxIdle > $minIdle ? 1.0 - (($m['idle'] - $minIdle) / ($maxIdle - $minIdle)) : 0.0;
            $nRating = $maxRating > $minRating ? 1.0 - (($m['rating'] - $minRating) / ($maxRating - $minRating)) : 0.0;

            $m['score'] = ($wDist * $nDist)
                + ($wIdle * $nIdle)
                + ($wAccept * (1.0 - $m['accept']))
                + ($wRating * $nRating);

            $m['candidate']->fairness_score = $m['score'];
        }

        usort($metrics, fn ($a, $b) => $a['score'] <=> $b['score']);

        return collect(array_column($metrics, 'candidate'));
    }

    public function createRideAttempts(RideBooking $rideBooking, $candidates, ?int $ttlSeconds = null, int $waveNumber = 1): void
    {
        $ttlSeconds ??= (int) setting('ride.dispatch.offer_ttl_seconds', 90);
        $expiresAt = now()->addSeconds($ttlSeconds);

        $candidates->values()->each(function (DriverAvailability $availability, int $index) use ($rideBooking, $expiresAt, $waveNumber) {
            $driver = $availability->driver;
            if (! $driver) {
                return;
            }

            RideDispatchAttempt::updateOrCreate(
                [
                    'ride_booking_id' => $rideBooking->id,
                    'driver_id' => $driver->id,
                ],
                [
                    'score' => $availability->fairness_score ?? -($index + 1), // Persist the score or the actual issued order if disabled
                    'distance_km' => $availability->distance !== null ? round((float) $availability->distance, 2) : null,
                    'rank' => $index + 1,
                    'wave_number' => $waveNumber,
                    'status' => 'offered',
                    'offered_at' => now(),
                    'expires_at' => $expiresAt,
                    'responded_at' => null,
                    'decline_reason' => null,
                ]
            );
        });
    }

    public function markAccepted(RideBooking $rideBooking, Driver $driver): void
    {
        RideDispatchAttempt::updateOrCreate(
            [
                'ride_booking_id' => $rideBooking->id,
                'driver_id' => $driver->id,
            ],
            [
                'status' => 'accepted',
                'responded_at' => now(),
                'offered_at' => $rideBooking->dispatchAttempts()->where('driver_id', $driver->id)->value('offered_at') ?? now(),
            ]
        );

        RideDispatchAttempt::query()
            ->where('ride_booking_id', $rideBooking->id)
            ->where('driver_id', '!=', $driver->id)
            ->where('status', 'offered')
            ->update([
                'status' => 'superseded',
                'responded_at' => now(),
            ]);
    }

    public function markDeclined(RideBooking $rideBooking, Driver $driver, ?string $reason = null): RideDispatchAttempt
    {
        return RideDispatchAttempt::updateOrCreate(
            [
                'ride_booking_id' => $rideBooking->id,
                'driver_id' => $driver->id,
            ],
            [
                'status' => 'declined',
                'responded_at' => now(),
                'decline_reason' => $reason,
                'offered_at' => $rideBooking->dispatchAttempts()->where('driver_id', $driver->id)->value('offered_at') ?? now(),
            ]
        );
    }

    public function expireOpenAttempts(): int
    {
        return RideDispatchAttempt::query()
            ->where('status', 'offered')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update([
                'status' => 'expired',
                'responded_at' => now(),
            ]);
    }

    /**
     * Take idle drivers offline once their location tracking has gone stale
     * (SKY-MRD-001 §13.3). A driver who reported a location and then went
     * silent past the threshold is no longer reachable for a live pickup, so
     * leaving them `online`/`is_available` makes them a dispatch black hole —
     * ranked as a candidate, offered rides, then timing out. Only currently
     * `online` rows are swept; `on_ride`/`on_tour` drivers are mid-service and
     * follow their own lifecycle, and rows that never reported a location
     * (`last_updated` null) are left for the driver to bring online.
     *
     * @return int number of availabilities taken offline
     */
    public function expireStaleAvailability(?int $staleAfterSeconds = null): int
    {
        $staleAfterSeconds ??= (int) setting('ride.dispatch.stale_availability_seconds', 300);

        return DriverAvailability::query()
            ->where('status', 'online')
            ->whereNotNull('last_updated')
            ->where('last_updated', '<=', now()->subSeconds($staleAfterSeconds))
            ->update([
                'status' => 'offline',
                'is_available' => false,
            ]);
    }

    public function recoverOrphanedAvailability(): int
    {
        $count = 0;
        DriverAvailability::where('status', 'on_ride')->orderBy('id')->chunkById(100, function ($rows) use (&$count) {
            foreach ($rows as $row) {
                $count += DB::transaction(function () use ($row) {
                    $driver = Driver::whereKey($row->driver_id)->lockForUpdate()->first();
                    $availability = DriverAvailability::whereKey($row->id)->lockForUpdate()->first();
                    if (! $driver || ! $availability || $availability->status !== 'on_ride' || $this->hasActiveWorkload($driver)) {
                        return 0;
                    }
                    $online = $driver->is_active && $driver->status === 'active' && $driver->isApproved()
                        && $availability->last_updated?->gte(now()->subSeconds((int) setting('ride.dispatch.stale_availability_seconds', 300)));
                    $availability->update(['status' => $online ? 'online' : 'offline', 'is_available' => (bool) $online]);
                    $lastRide = $driver->rideBookings()->whereIn('status', ['cancelled', 'completed'])->latest('id')->first();
                    $lastRide?->auditLogs()->create([
                        'action' => 'driver.availability_recovered',
                        'before' => ['status' => 'on_ride'],
                        'after' => ['driver_id' => $driver->id, 'status' => $availability->status],
                        'note' => 'No active ride, rental or current tour commitment exists.',
                    ]);
                    \Illuminate\Support\Facades\Log::info('Recovered orphaned driver availability', ['driver_id' => $driver->id, 'status' => $availability->status]);

                    return 1;
                });
            }
        });

        return $count;
    }

    public function acceptanceRate(Driver $driver): float
    {
        $total = $driver->rideDispatchAttempts()
            ->whereIn('status', ['accepted', 'declined', 'expired'])
            ->count();

        if ($total === 0) {
            return 0.5;
        }

        $accepted = $driver->rideDispatchAttempts()
            ->where('status', 'accepted')
            ->count();

        return $accepted / $total;
    }

    public function rideServiceType(RideBooking $rideBooking): string
    {
        if (in_array($rideBooking->service_type, ['hourly', 'round_trip'], true)) {
            return 'long_ride';
        }

        return (float) $rideBooking->estimated_distance_km < 80
            ? 'short_ride'
            : 'long_ride';
    }

    public function eligibilityFailures(
        Driver $driver,
        string $serviceType,
        ?string $role = null,
        ?int $carCategoryId = null,
        ?int $vehicleId = null,
        ?float $pickupLat = null,
        ?float $pickupLng = null,
        ?float $radiusKm = null,
        ?int $excludeTourAssignmentId = null,
        ?RideBooking $rideBooking = null,
        ?int $excludeCarRentalId = null
    ): array {
        $radiusKm ??= (float) setting('ride.dispatch.pickup_radius_km', self::DEFAULT_PICKUP_RADIUS_KM, array_filter([
            'lat' => $pickupLat,
            'lng' => $pickupLng,
        ], fn ($value) => $value !== null));
        $failures = [];

        $verification = app(DriverEligibilityService::class)->evaluate($driver, $serviceType, $vehicleId ? Vehicle::find($vehicleId) : $driver->vehicle);
        $failures = array_merge($failures, $verification['reasons']);

        if (! $driver->isApproved() || ! $driver->is_active || $driver->status !== 'active') {
            $failures[] = 'Driver is not active and approved.';
        }

        if (! app(DriverFundingPolicy::class)->eligible($driver)) {
            $failures[] = 'Driver wallet balance is below the minimum required for dispatch.';
        }

        if (! $driver->canHandleService($serviceType, $role)) {
            $failures[] = 'Driver does not have the required service capability.';
        }

        if ($this->hasActiveWorkload($driver, $excludeTourAssignmentId, $rideBooking?->id, $excludeCarRentalId)) {
            $failures[] = 'Driver already has an active ride, tour, or rental assignment.';
        }

        if ($rideBooking !== null) {
            $commitmentService = app(ResourceCommitmentService::class);
            $rideInterval = $commitmentService->getRideInterval($rideBooking);
            $conflicts = $commitmentService->findConflicts(
                $driver->id,
                $vehicleId ?: $driver->vehicle?->id,
                $rideInterval['start'],
                $rideInterval['end'],
                [
                    'exclude_ride_booking_id' => $rideBooking->id,
                    'exact_interval' => true,
                ]
            );
            foreach ($conflicts as $conflict) {
                $failures[] = $conflict;
            }
        }

        if ($vehicleFailure = $this->vehicleEligibilityFailure($driver, $carCategoryId, $vehicleId)) {
            $failures[] = $vehicleFailure;
        }

        $isScheduledFuture = ($serviceType === 'rental')
            || ($rideBooking !== null
                && $rideBooking->scheduled_at !== null
                && $rideBooking->scheduled_at->gt(now()->addMinutes((int) setting('ride.dispatch.window_minutes', 15))));

        if (! $isScheduledFuture && $pickupLat !== null && $pickupLng !== null) {
            $availability = $driver->driverAvailability;
            if (! $availability || ! $availability->is_available || $availability->status !== 'online') {
                $failures[] = 'Driver is not currently online and available.';
            } elseif (! $availability->last_updated || $availability->last_updated->lt(now()->subSeconds((int) setting('ride.dispatch.stale_availability_seconds', 300)))) {
                $failures[] = 'Driver location is out of date.';
            } elseif ($availability->current_lat === null || $availability->current_lng === null) {
                $failures[] = 'Driver has no current location.';
            } else {
                $distance = $this->distanceKm(
                    $pickupLat,
                    $pickupLng,
                    (float) $availability->current_lat,
                    (float) $availability->current_lng
                );

                if ($distance > $radiusKm) {
                    $failures[] = "Driver is outside the {$radiusKm} km pickup radius.";
                }
            }
        }

        return $failures;
    }

    private function vehicleEligibilityFailure(Driver $driver, ?int $carCategoryId = null, ?int $vehicleId = null): ?string
    {
        if ($vehicleId !== null) {
            $vehicle = Vehicle::find($vehicleId);
            if (! $vehicle || ! $vehicle->is_active) {
                return 'Selected vehicle is not active.';
            }

            if ((int) $vehicle->driver_id !== (int) $driver->id) {
                return 'Selected vehicle is not assigned to this driver.';
            }

            if ($carCategoryId !== null && (int) $vehicle->car_category_id !== (int) $carCategoryId) {
                return 'Selected vehicle does not match the requested car category.';
            }

            return null;
        }

        $vehicle = $driver->vehicle;
        if (! $vehicle || ! $vehicle->isApprovedForService()) {
            return 'Driver does not have an approved, service-ready vehicle.';
        }

        if ($carCategoryId !== null && (int) $vehicle->car_category_id !== (int) $carCategoryId) {
            return 'Driver vehicle does not match the requested car category.';
        }

        return null;
    }

    private function nearbyAvailability(float $pickupLat, float $pickupLng, ?float $radiusKm = null)
    {
        $radiusKm ??= (float) setting('ride.dispatch.pickup_radius_km', self::DEFAULT_PICKUP_RADIUS_KM, [
            'lat' => $pickupLat,
            'lng' => $pickupLng,
        ]);
        $query = DriverAvailability::query()
            ->with(['driver.vehicle', 'driver.driverAvailability', 'driver' => fn ($q) => $q->withExists([
                'rideBookings as has_active_ride' => fn ($r) => $r->where(function ($sub) {
                    $sub->whereIn('status', ['driver_arriving', 'pickup', 'in_transit'])
                        ->orWhere(fn ($q2) => $q2->where('status', 'driver_assigned')->where(fn ($q3) => $q3->whereNull('scheduled_at')->orWhere('scheduled_at', '<=', now()->addMinutes(15))));
                }),
                'carRentals as has_active_rental' => fn ($r) => $r->whereIn('status', ['driver_assigned', 'in_progress']),
                'tourDriverAssignments as has_active_tour' => fn ($r) => $r->whereIn('status', ['assigned', 'accepted'])->whereHas('schedule', fn ($t) => $t->inProgressWindow()),
            ])])
            ->active()
            ->where(fn ($q) => $q->whereNull('last_updated')->orWhere('last_updated', '>=', now()->subSeconds((int) setting('ride.dispatch.stale_availability_seconds', 300))))
            ->whereBetween('current_lat', [max(-90, $pickupLat - $radiusKm / 110), min(90, $pickupLat + $radiusKm / 110)])
            ->whereBetween('current_lng', [-180, 180]);
        if (DB::connection()->getDriverName() !== 'sqlite') {
            return $query->nearLocation($pickupLat, $pickupLng, $radiusKm)->limit(200)->get();
        }

        return $query->orderByRaw('(current_lat - ?) * (current_lat - ?) + (current_lng - ?) * (current_lng - ?) * ?', [$pickupLat, $pickupLat, $pickupLng, $pickupLng, cos(deg2rad($pickupLat)) ** 2])->orderBy('driver_id')->limit(200)->get()
            ->map(function (DriverAvailability $availability) use ($pickupLat, $pickupLng) {
                $availability->setAttribute('distance', $this->distanceKm($pickupLat, $pickupLng, (float) $availability->current_lat, (float) $availability->current_lng));

                return $availability;
            })
            ->filter(fn (DriverAvailability $availability) => (float) $availability->distance <= $radiusKm);
    }

    public function hasActiveWorkload(Driver $driver, ?int $excludeTourAssignmentId = null, ?int $excludeRideBookingId = null, ?int $excludeCarRentalId = null): bool
    {
        $windowMinutes = (int) setting('ride.dispatch.window_minutes', 15);
        $dueThreshold = now()->addMinutes($windowMinutes);

        return RideBooking::query()
            ->where('driver_id', $driver->id)
            ->when($excludeRideBookingId !== null, fn ($q) => $q->whereKeyNot($excludeRideBookingId))
            ->where(function ($q) use ($dueThreshold) {
                $q->whereIn('status', ['driver_arriving', 'pickup', 'in_transit'])
                    ->orWhere(function ($sub) use ($dueThreshold) {
                        $sub->where('status', 'driver_assigned')
                            ->where(function ($dateQ) use ($dueThreshold) {
                                $dateQ->whereNull('scheduled_at')
                                    ->orWhere('scheduled_at', '<=', $dueThreshold);
                            });
                    });
            })
            ->exists()
            || $driver->carRentals()
                ->when($excludeCarRentalId !== null, fn ($q) => $q->whereKeyNot($excludeCarRentalId))
                ->whereIn('status', ['driver_assigned', 'in_progress'])
                ->whereDate('start_date', '<=', today())
                ->whereDate('end_date', '>=', today())
                ->exists()
            || $driver->tourDriverAssignments()
                ->when($excludeTourAssignmentId !== null, fn ($query) => $query->whereKeyNot($excludeTourAssignmentId))
                ->whereIn('status', ['assigned', 'accepted'])
                ->whereHas('schedule', function ($query) {
                    $query->inProgressWindow();
                })
                ->exists();
    }

    public function workloadScore(Driver $driver): int
    {
        return RideBooking::query()
            ->where('driver_id', $driver->id)
            ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
            ->count()
            + RideBooking::query()
                ->where('driver_id', $driver->id)
                ->whereIn('status', ['pending', 'confirmed'])
                ->where('scheduled_at', '>=', now())
                ->count()
            + $driver->carRentals()
                ->whereIn('status', ['driver_assigned', 'in_progress', 'confirmed'])
                ->whereDate('start_date', '>=', today())
                ->count()
            + $driver->tourDriverAssignments()
                ->whereIn('status', ['assigned', 'accepted'])
                ->whereHas('schedule', function ($query) {
                    $localDate = now()->timezone(config('app.business_timezone', 'Asia/Kolkata'))->toDateString();
                    $query->whereNotIn('status', ['cancelled', 'completed'])
                        ->where(fn ($q) => $q->where('departure_at', '>', now()->utc())
                            ->orWhere(fn ($legacy) => $legacy->whereNull('departure_at')->whereDate('departure_date', '>=', $localDate)));
                })
                ->count();
    }

    public function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
            * sin($lngDelta / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    public function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        return $this->distanceKm($lat1, $lng1, $lat2, $lng2);
    }
}

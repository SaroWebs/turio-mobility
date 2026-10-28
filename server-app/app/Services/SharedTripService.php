<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverLocation;
use App\Models\RideBooking;
use App\Models\SharedTrip;
use App\Models\Vehicle;
use App\Models\Wallet;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SharedTripService
{
    public const ACTIVE = ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'];

    public function __construct(private SharedRidePlanner $planner, private ResourceCommitmentService $commitments, private PoolingSchedule $schedule) {}

    public function remaining(SharedTrip $trip): array
    {
        $bookings = $trip->bookings()->orderBy('id')->when(DB::transactionLevel() > 0, fn ($q) => $q->lockForUpdate())->get()->keyBy('id');

        return array_values(array_filter($trip->stops, function ($stop) use ($bookings) {
            $b = $bookings->get($stop['booking_id']);

            return $b && in_array($b->status, self::ACTIVE, true) && ($stop['type'] !== 'pickup' || $b->status !== 'in_transit');
        }));
    }

    public function state(SharedTrip $trip): ?array
    {
        $locking = DB::transactionLevel() > 0;
        $driver = Driver::whereKey($trip->driver_id)->when($locking, fn ($q) => $q->lockForUpdate())->first();
        $vehicle = Vehicle::whereKey($trip->vehicle_id)->when($locking, fn ($q) => $q->lockForUpdate())->first();
        $availability = $driver?->driverAvailability()->when($locking, fn ($q) => $q->lockForUpdate())->first();
        $gps = DriverLocation::where('driver_id', $trip->driver_id)->orderByDesc('recorded_at')->orderByDesc('id')->when($locking, fn ($q) => $q->lockForUpdate())->first();
        if (! $trip->accepting || ! $driver?->is_active || ! $driver->is_approved || ! $vehicle?->isApprovedForService()
            || ! app(DriverEligibilityService::class)->evaluate($driver, 'short_ride', $vehicle)['eligible']
            || $vehicle->driver_id != $driver->id || ! $availability || $availability->status === 'offline'
            || ! $gps?->recorded_at || $gps->recorded_at->lt(now()->subSeconds(config('pooling.gps_max_age_seconds')))
            || $gps->recorded_at->gt(now()) || $gps->accuracy === null || $gps->accuracy > config('pooling.gps_max_accuracy_m')) {
            return null;
        }
        $bookings = $trip->bookings()->whereIn('status', self::ACTIVE)->orderBy('id')->when($locking, fn ($q) => $q->lockForUpdate())->get();
        $stops = $this->remaining($trip);
        if (! $stops || $bookings->contains(fn ($b) => ! $b->sharing_requested || $b->driver_id != $trip->driver_id || $b->vehicle_id != $trip->vehicle_id)) {
            return null;
        }

        return [
            'position' => ['lat' => (float) $gps->latitude, 'lng' => (float) $gps->longitude],
            'gps_id' => $gps->id, 'geometry' => $trip->geometry, 'stops' => $stops,
            'progress_buffer_m' => 20 + (float) $gps->accuracy + max(0, (float) ($gps->speed ?? 15)) * max(0, now()->timestamp - $gps->recorded_at->timestamp),
            'capacity' => min(max(0, (int) $vehicle->seats - 1), (int) ($availability->sharing_seat_capacity ?: $vehicle->seats - 1)),
            'onboard' => (int) $bookings->where('status', 'in_transit')->sum('reserved_seats'),
            'allow_extension' => $trip->allow_extension, 'original_destination' => $trip->original_destination,
            'original_ends_at' => $trip->original_ends_at->timestamp,
            'fingerprint' => hash('sha256', json_encode([$trip->version, $bookings->map(fn ($b) => [$b->id, $b->status, $b->reserved_seats, $b->driver_id, $b->vehicle_id])->all()])),
        ];
    }

    public function open(RideBooking $ride, Driver $driver, bool $extension): SharedTrip
    {
        abort_unless($ride->driver_id == $driver->id && $ride->sharing_requested && $ride->service_type === 'point_to_point'
            && in_array($ride->status, self::ACTIVE, true), 409, 'An assigned, sharing-consented point-to-point ride is required.');
        abort_if($ride->dropoff_lat === null || $ride->dropoff_lng === null, 409, 'Destination coordinates are required.');
        $gps = DriverLocation::where('driver_id', $driver->id)->orderByDesc('recorded_at')->first();
        abort_unless($gps && $gps->recorded_at?->gte(now()->subSeconds(config('pooling.gps_max_age_seconds'))) && $gps->accuracy !== null && $gps->accuracy <= config('pooling.gps_max_accuracy_m'), 409, 'A fresh, accurate driver location is required.');
        $position = ['lat' => (float) $gps->latitude, 'lng' => (float) $gps->longitude];
        $destination = ['lat' => (float) $ride->dropoff_lat, 'lng' => (float) $ride->dropoff_lng, 'label' => $ride->dropoff_location];
        $stops = [];
        if ($ride->status !== 'in_transit') {
            abort_if($ride->pickup_lat === null || $ride->pickup_lng === null, 409, 'Pickup coordinates are required.');
            $stops[] = ['lat' => (float) $ride->pickup_lat, 'lng' => (float) $ride->pickup_lng, 'label' => $ride->pickup_location,
                'booking_id' => $ride->id, 'type' => 'pickup', 'seats' => (int) $ride->reserved_seats,
                'ready_at' => max(now()->timestamp, $ride->scheduled_at?->timestamp ?? 0)];
        }
        $stops[] = $destination + ['booking_id' => $ride->id, 'type' => 'dropoff', 'seats' => (int) $ride->reserved_seats];
        $route = $this->planner->route($position, $stops, now()->timestamp);
        abort_unless($route, 503, 'Road routing is unavailable.');

        return DB::transaction(function () use ($ride, $driver, $extension, $route, $destination) {
            $this->commitments->lockResources($driver->id, $ride->vehicle_id);
            $locked = RideBooking::lockForUpdate()->findOrFail($ride->id);
            abort_unless($locked->driver_id == $driver->id && $locked->status === $ride->status && in_array($locked->status, self::ACTIVE, true) && $locked->sharing_requested, 409);
            if ($locked->shared_trip_id) {
                $trip = SharedTrip::lockForUpdate()->findOrFail($locked->shared_trip_id);
                $trip->update(['accepting' => true, 'allow_extension' => $extension, 'version' => $trip->version + 1]);

                return $trip;
            }
            abort_if(RideBooking::where('driver_id', $driver->id)->whereIn('status', self::ACTIVE)->whereKeyNot($ride->id)->exists(), 409, 'Driver already has another active trip.');
            $stops = $route['stops'];
            $stops = array_map(fn ($stop) => $stop + ['latest' => $stop['eta'] + config('pooling.max_delay_seconds')], $stops);
            $trip = SharedTrip::create(['driver_id' => $driver->id, 'vehicle_id' => $locked->vehicle_id, 'root_booking_id' => $ride->id,
                'allow_extension' => $extension, 'stops' => $stops, 'geometry' => $route['geometry'], 'original_destination' => $destination,
                'ends_at' => Carbon::createFromTimestamp($route['ends_at']), 'original_ends_at' => Carbon::createFromTimestamp($route['ends_at'])]);
            $locked->forceFill(['shared_trip_id' => $trip->id])->save();

            return $trip;
        });
    }

    private function conflicts(SharedTrip $trip, array $plan): array
    {
        return $this->commitments->findConflicts($trip->driver_id, $trip->vehicle_id, now(), Carbon::createFromTimestamp($plan['ends_at'])->addSeconds(config('pooling.schedule_buffer_seconds')), [
            'exact_interval' => true, 'exclude_shared_trip_id' => $trip->id,
        ]);
    }

    public function search(Customer $customer, array $request): array
    {
        $results = [];
        $lat = $request['pickup']['lat'];
        $lng = $request['pickup']['lng'];
        $lngRadius = .2 / max(.01, cos(deg2rad($lat)));
        $nearby = \App\Models\DriverAvailability::whereBetween('current_lat', [$lat - .2, $lat + .2])
            ->whereBetween('current_lng', [$lng - $lngRadius, $lng + $lngRadius])->select('driver_id');
        foreach (SharedTrip::where('accepting', true)->whereIn('driver_id', $nearby)
            ->whereHas('bookings', fn ($q) => $q->whereIn('status', self::ACTIVE))
            ->where('ends_at', '>', now()->subMinutes(15))->orderBy('id')->limit(40)->get() as $trip) {
            if ($trip->bookings()->where('customer_id', $customer->id)->exists()) {
                continue;
            }
            $state = $this->state($trip);
            if (! $state || SharedRidePlanner::distance($state['position'], $request['pickup']) > 20000) {
                continue;
            }
            $plan = $this->planner->match($state, $request, now()->timestamp);
            if (! $plan || $this->conflicts($trip, $plan) || ! $this->schedule->permits($this->schedule->snapshot($trip), $plan)) {
                continue;
            }
            $estimate = app(RideEstimateService::class)->estimate($request['pickup']['lat'], $request['pickup']['lng'], $request['dropoff']['lat'], $request['dropoff']['lng'], 'point_to_point', true, $request['seats']);
            $fees = app(\App\Support\Pricing\PricingService::class)->applyFees((float) $estimate['pricing']['subtotal'], $request['pickup']);
            $id = (string) Str::uuid();
            $expiry = now()->addSeconds(config('pooling.offer_seconds'));
            Cache::put('pool-offer:'.$id, ['customer_id' => $customer->id, 'trip_id' => $trip->id, 'version' => $trip->version, 'request' => $request, 'estimate' => $estimate, 'fees' => $fees, 'expires' => $expiry->timestamp], $expiry);
            $driver = Driver::find($trip->driver_id);
            $vehicle = Vehicle::find($trip->vehicle_id);
            $results[] = ['offer_id' => $id, 'expires_at' => $expiry->toISOString(), 'pickup_at' => Carbon::createFromTimestamp($plan['pickup_at'])->toISOString(),
                'dropoff_at' => Carbon::createFromTimestamp($plan['dropoff_at'])->toISOString(), 'fare' => $fees['total'], 'seats' => $request['seats'],
                'extension' => $plan['extension'], 'driver_name' => $driver->name, 'vehicle' => trim($vehicle->make.' '.$vehicle->model), 'score' => $plan['score']];
        }
        usort($results, fn ($a, $b) => $a['score'] <=> $b['score']);

        return $results;
    }

    public function join(Customer $customer, string $offerId, string $payment): RideBooking
    {
        $existing = RideBooking::where('shared_offer_id', $offerId)->first();
        if ($existing) {
            abort_unless($existing->customer_id == $customer->id && $existing->payment_method === $payment, 409, 'Offer already used.');

            return $existing;
        }
        $offer = Cache::get('pool-offer:'.$offerId);
        abort_unless($offer && $offer['customer_id'] == $customer->id && $offer['expires'] > now()->timestamp, 409, 'Offer expired. Refresh the available rides.');
        $trip = SharedTrip::findOrFail($offer['trip_id']);
        $state = $this->state($trip);
        abort_unless($state && $trip->version == $offer['version'], 409, 'Trip changed. Refresh the available rides.');
        $plan = $this->planner->match($state, $offer['request'], now()->timestamp);
        $schedule = $this->schedule->snapshot($trip);
        abort_unless($plan && ! $this->conflicts($trip, $plan) && $this->schedule->permits($schedule, $plan), 409, 'This ride is no longer available.');

        return DB::transaction(function () use ($customer, $offerId, $payment, $offer, $trip, $state, $plan, $schedule) {
            Customer::whereKey($customer->id)->lockForUpdate()->firstOrFail();
            $this->commitments->lockResources($trip->driver_id, $trip->vehicle_id);
            $trip = SharedTrip::lockForUpdate()->findOrFail($trip->id);
            // Start the consistent-read snapshot only after resource locks; avoid missing-key gap locks.
            $existing = RideBooking::where('shared_offer_id', $offerId)->first();
            if ($existing) {
                abort_unless($existing->customer_id == $customer->id && $existing->payment_method === $payment, 409);

                return $existing;
            }
            $latest = $this->state($trip);
            $pickupProgress = $latest ? $this->planner->project($offer['request']['pickup'], $latest['geometry']) : null;
            $carProgress = $latest ? $this->planner->project($latest['position'], $latest['geometry']) : null;
            abort_unless($latest && $offer['expires'] > now()->timestamp && $latest['fingerprint'] === $state['fingerprint']
                && $pickupProgress && $carProgress && $pickupProgress['along'] >= $carProgress['along'] + $latest['progress_buffer_m']
                && $latest['gps_id'] === $state['gps_id'] && $latest['position'] === $state['position']
                && $latest['capacity'] === $state['capacity']
                && $this->schedule->snapshot($trip) === $schedule
                && $plan['pickup_at'] >= now()->timestamp + config('pooling.pickup_buffer_seconds') && ! $this->conflicts($trip, $plan), 409, 'The vehicle or trip changed. Refresh and try again.');
            abort_if(RideBooking::where('customer_id', $customer->id)->whereIn('status', self::ACTIVE)->exists(), 409, 'Complete or cancel your current ride first.');
            $request = $offer['request'];
            $estimate = $offer['estimate'];
            $fees = $offer['fees'];
            $ride = new RideBooking;
            $ride->forceFill([
                'booking_number' => RideBooking::generateBookingNumber(), 'customer_id' => $customer->id,
                'customer_name' => $customer->name, 'customer_email' => $customer->email, 'customer_phone' => $customer->phone,
                'driver_id' => $trip->driver_id, 'vehicle_id' => $trip->vehicle_id, 'shared_trip_id' => $trip->id, 'shared_offer_id' => $offerId,
                'service_type' => 'point_to_point', 'ride_mode' => 'shared', 'sharing_requested' => true, 'sharing_enabled_by' => 'customer', 'reserved_seats' => $request['seats'],
                'pickup_location' => $request['pickup']['label'], 'pickup_lat' => $request['pickup']['lat'], 'pickup_lng' => $request['pickup']['lng'],
                'dropoff_location' => $request['dropoff']['label'], 'dropoff_lat' => $request['dropoff']['lat'], 'dropoff_lng' => $request['dropoff']['lng'],
                'scheduled_at' => Carbon::createFromTimestamp($plan['pickup_at']), 'driver_assigned_at' => now(),
                'estimated_distance_km' => round($plan['distance_m'] / 1000, 2), 'estimated_duration' => (int) ceil(($plan['dropoff_at'] - $plan['pickup_at']) / 60),
                'base_fare' => $estimate['pricing']['base_fare'], 'distance_fare' => $estimate['pricing']['distance_fare'], 'surge_multiplier' => $estimate['pricing']['surge_multiplier'],
                'full_car_fare' => $estimate['pricing']['private_subtotal'], 'sharing_discount_percent' => $estimate['pricing']['sharing_discount_percent'], 'sharing_savings' => $estimate['pricing']['sharing_savings'],
                'tax_amount' => $fees['tax'], 'service_fee_amount' => $fees['service_fee'], 'total_fare' => $fees['total'],
                'payment_method' => $payment, 'payment_status' => 'pending', 'status' => 'driver_assigned', 'dispatch_status' => 'assigned', 'admin_assignable' => false,
                'start_ride_pin' => RideBooking::generateStartRidePin(),
            ])->save();
            if ($payment === 'wallet') {
                $wallet = Wallet::forOwner($customer)->lockForUpdate()->first();
                abort_unless($wallet && $wallet->hasSufficientBalance($fees['total']), 422, 'Insufficient wallet balance.');
                $wallet->debit($fees['total'], "Payment for Ride Booking #{$ride->id}", 'ride_booking', $ride->id);
                $ride->update(['payment_status' => 'paid']);
            }
            $stops = array_map(function ($stop) use ($ride) {
                if ($stop['booking_id'] === 'new') {
                    $stop['booking_id'] = $ride->id;
                }

                return $stop;
            }, $plan['stops']);
            $trip->update(['stops' => $stops, 'geometry' => $plan['geometry'], 'ends_at' => Carbon::createFromTimestamp($plan['ends_at']), 'version' => $trip->version + 1]);
            DB::afterCommit(function () use ($ride) {
                app(BookingLifecycleNotifier::class)->emit($ride->fresh('customer'), 'booking.created');
                if ($ride->payment_status === 'paid') {
                    app(BookingLifecycleNotifier::class)->emit($ride->fresh('customer'), 'payment.paid');
                }
                try {
                    broadcast(new \App\Events\RideAssigned($ride, $ride->driver_id));
                } catch (\Throwable $e) {
                    report($e);
                }
            });

            return $ride;
        });
    }

    public function nextRide(int $driverId): ?RideBooking
    {
        foreach (SharedTrip::where('driver_id', $driverId)->orderByDesc('id')->get() as $trip) {
            $stops = $this->remaining($trip);
            if ($stops) {
                return RideBooking::find($stops[0]['booking_id']);
            }
        }

        return null;
    }

    public function driverView(RideBooking $ride): ?array
    {
        $trip = $ride->shared_trip_id ? SharedTrip::find($ride->shared_trip_id) : null;
        if (! $trip) {
            return null;
        }

        return ['id' => $trip->id, 'accepting' => $trip->accepting, 'allow_extension' => $trip->allow_extension, 'stops' => $this->remaining($trip),
            'geometry' => array_map(fn ($p) => ['latitude' => $p['lat'], 'longitude' => $p['lng']], $trip->geometry)];
    }
}

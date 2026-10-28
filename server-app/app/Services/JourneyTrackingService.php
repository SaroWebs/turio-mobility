<?php

namespace App\Services;

use App\Events\RentalLocationUpdated;
use App\Events\RideLocationUpdated;
use App\Events\TourLocationUpdated;
use App\Models\CarRental;
use App\Models\Driver;
use App\Models\DriverLocation;
use App\Models\RideBooking;
use App\Models\TourBooking;
use App\Models\Vehicle;

/** One source decision for customer tracking, broadcasts and the admin map. */
class JourneyTrackingService
{
    public function resolve(?Vehicle $vehicle, ?int $driverId = null): array
    {
        $preference = $vehicle?->tracking_preference ?? 'automatic';
        $driverId ??= $vehicle?->driver_id;
        $tracker = $vehicle?->tracker;
        $phone = $driverId ? DriverLocation::where('driver_id', $driverId)->orderByRaw('COALESCE(recorded_at, created_at) DESC')->orderByDesc('id')->first() : null;
        $gps = $tracker && $tracker->status === 'active' && $tracker->latitude !== null && $tracker->longitude !== null ? [
            'latitude' => (float) $tracker->latitude, 'longitude' => (float) $tracker->longitude,
            'recorded_at' => $tracker->last_recorded_at ?? $tracker->last_ping_at,
            'speed_kmh' => $tracker->speed_kmh, 'accuracy_m' => $tracker->accuracy_m, 'heading' => $tracker->heading,
        ] : null;
        $mobile = $phone ? [
            'latitude' => (float) $phone->latitude, 'longitude' => (float) $phone->longitude,
            'recorded_at' => $phone->recorded_at ?? $phone->created_at,
            'speed_kmh' => $phone->speed !== null ? round((float) $phone->speed * 3.6, 2) : null,
            'accuracy_m' => $phone->accuracy, 'heading' => $phone->heading,
        ] : null;
        $ttl = (int) setting('tracking.freshness_seconds', 60);
        $fresh = fn ($point) => $point && $point['recorded_at'] && $point['recorded_at']->greaterThanOrEqualTo(now()->subSeconds($ttl));
        $source = match ($preference) {
            'driver_app' => 'driver_app',
            'vehicle_gps' => 'vehicle_gps',
            default => $fresh($gps) ? 'vehicle_gps' : ($fresh($mobile) ? 'driver_app' : ($mobile ? 'driver_app' : 'vehicle_gps')),
        };
        $point = $source === 'vehicle_gps' ? $gps : $mobile;
        $online = (bool) $fresh($point);

        return [
            'tracking_preference' => $preference,
            'location_source' => $point ? $source : 'unavailable',
            'is_online' => $online,
            'latest_location' => $point,
            'locations' => $point ? [$point] : [],
            'reason' => ! $point ? 'Waiting for a position from the selected source.' : (! $online ? 'Last known position; source is stale.' : ($source === 'driver_app' && $preference === 'automatic' ? 'Using assigned driver phone; no fresh vehicle tracker.' : 'Selected source is live.')),
            'stale_after_seconds' => $ttl,
        ];
    }

    public function forBooking(RideBooking|TourBooking|CarRental $booking): array
    {
        if ($booking instanceof TourBooking) {
            $assignment = $booking->driverAssignments()->where('status', 'accepted')->whereIn('role', ['transport', 'both'])->orderBy('id')->first();
            $vehicle = $assignment?->vehicle;
            $driverId = $assignment?->driver_id;
        } else {
            $driverId = $booking->driver_id;
            $vehicle = $booking->vehicle_id ? Vehicle::find($booking->vehicle_id) : null;
        }
        // Never use the vehicle's former/default driver for a reassigned booking.
        $resolved = $driverId ? $this->resolve($vehicle, $driverId) : $this->resolve(null);
        $point = $resolved['latest_location'];
        if (! in_array($booking->status, ['completed', 'cancelled'], true)) {
            $booking->current_lat = $point['latitude'] ?? null;
            $booking->current_lng = $point['longitude'] ?? null;
            $booking->last_location_update = $point['recorded_at'] ?? null;
        } else {
            $resolved['is_online'] = false;
        }

        return $resolved;
    }

    public function publishForDriver(Driver $driver): void
    {
        $bookings = RideBooking::where('driver_id', $driver->id)->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])->get()->all();
        $bookings = array_merge($bookings, CarRental::where('driver_id', $driver->id)->whereIn('status', ['driver_assigned', 'in_progress'])->get()->all());
        $bookings = array_merge($bookings, TourBooking::whereIn('status', ['confirmed', 'in_progress'])
            ->whereHas('driverAssignments', fn ($q) => $q->where('driver_id', $driver->id)->where('status', 'accepted')->whereIn('role', ['transport', 'both']))->get()->all());
        foreach ($bookings as $booking) {
            $resolved = $this->forBooking($booking);
            if (! $resolved['is_online']) {
                continue;
            }
            $booking->save();
            $lat = (float) $booking->current_lat;
            $lng = (float) $booking->current_lng;
            $event = match (true) {
                $booking instanceof RideBooking => new RideLocationUpdated($booking, $lat, $lng),
                $booking instanceof TourBooking => new TourLocationUpdated($booking, $lat, $lng, $booking->current_stop_index),
                default => new RentalLocationUpdated($booking, $lat, $lng),
            };
            broadcast($event);
        }
    }
}

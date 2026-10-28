<?php

namespace App\Services;

use App\Models\DriverAvailability;
use Illuminate\Support\Facades\DB;

class RideEstimateService
{
    /** Base fare in INR */
    public const BASE_FARE = 50;

    /** Rate per km in INR */
    public const PER_KM_RATE = 15;

    /** Surge multiplier threshold (number of nearby drivers) */
    public const SURGE_DRIVER_THRESHOLD = 3;

    /** Surge multiplier applied when drivers < threshold */
    public const SURGE_MULTIPLIER = 1.2;

    /** Assumed average speed in km/h used for duration estimate */
    public const AVERAGE_SPEED_KMH = 30;

    public const SHORT_RIDE_THRESHOLD_KM = 80;

    /** Shared point-to-point fare is 65% for one seat, then +15% per extra seat. */
    public const SHARED_BASE_MULTIPLIER = 0.65;

    public const SHARED_EXTRA_SEAT_MULTIPLIER = 0.15;

    public const MAX_SHARED_SEATS_PER_BOOKING = 3;

    public const VEHICLE_MULTIPLIERS = ['mini' => 0.85, 'comfort' => 1.0, 'xl' => 1.45];

    /**
     * Calculate the Haversine great-circle distance in kilometres between two coordinates.
     */
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

    /**
     * Count active drivers within $radiusKm of the given pickup point.
     */
    public function nearbyDriverCount(float $lat, float $lng, float $radiusKm = DriverDispatchService::DEFAULT_PICKUP_RADIUS_KM): int
    {
        return $this->nearbyAvailabilityCount($lat, $lng, $radiusKm);
    }

    public function nearbySharingDriverCount(float $lat, float $lng, float $radiusKm = DriverDispatchService::DEFAULT_PICKUP_RADIUS_KM): int
    {
        return $this->nearbyAvailabilityCount($lat, $lng, $radiusKm, true);
    }

    /**
     * Return map-safe coordinates for currently available drivers near a pickup.
     *
     * Driver identities are deliberately omitted from the public estimate response.
     *
     * @return array<int, array{lat: float, lng: float}>
     */
    public function nearbyDriverLocations(
        float $lat,
        float $lng,
        float $radiusKm = DriverDispatchService::DEFAULT_PICKUP_RADIUS_KM,
        int $limit = 24
    ): array {
        $query = $this->activeAvailabilityQuery()
            ->whereNotNull('current_lat')
            ->whereNotNull('current_lng');

        $availabilities = DB::connection()->getDriverName() === 'sqlite'
            ? $query->get()
                ->filter(fn (DriverAvailability $availability) => $this->distanceKm(
                    $lat,
                    $lng,
                    (float) $availability->current_lat,
                    (float) $availability->current_lng
                ) <= $radiusKm)
                ->sortBy(fn (DriverAvailability $availability) => $this->distanceKm(
                    $lat,
                    $lng,
                    (float) $availability->current_lat,
                    (float) $availability->current_lng
                ))
                ->take($limit)
            : $query->nearLocation($lat, $lng, $radiusKm)
                ->limit($limit)
                ->get();

        return $availabilities
            ->map(fn (DriverAvailability $availability) => [
                'lat' => round((float) $availability->current_lat, 5),
                'lng' => round((float) $availability->current_lng, 5),
            ])
            ->values()
            ->all();
    }

    private function nearbyAvailabilityCount(float $lat, float $lng, float $radiusKm = 5, bool $sharingOnly = false): int
    {
        $query = $this->activeAvailabilityQuery($sharingOnly);

        if (DB::connection()->getDriverName() === 'sqlite') {
            return $query
                ->whereNotNull('current_lat')
                ->whereNotNull('current_lng')
                ->get()
                ->filter(fn (DriverAvailability $availability) => $this->distanceKm(
                    $lat,
                    $lng,
                    (float) $availability->current_lat,
                    (float) $availability->current_lng
                ) <= $radiusKm)
                ->count();
        }

        return $query
            ->nearLocation($lat, $lng, $radiusKm)
            ->count();
    }

    private function activeAvailabilityQuery(bool $sharingOnly = false)
    {
        return DriverAvailability::active()
            ->where(fn ($q) => $q->whereNull('last_updated')->orWhere('last_updated', '>=', now()->subSeconds((int) setting('ride.dispatch.stale_availability_seconds', 300))))
            ->whereHas('driver', fn ($driver) => $driver
                ->where('status', 'active')
                ->where('is_active', true)
                ->where('is_approved', true))
            ->when($sharingOnly, fn ($builder) => $builder->sharing());
    }

    /**
     * Compute the full ride estimate.
     *
     * @param  float|null  $dropoffLat  null for hourly/open-ended rides
     * @return array{
     *   distance_km: float,
     *   estimated_duration: int,
     *   nearby_drivers: int,
     *   pricing: array{
     *     base_fare: float,
     *     distance_fare: float,
     *     surge_multiplier: float,
     *     subtotal: float,
     *   }
     * }
     */
    public function estimate(
        float $pickupLat,
        float $pickupLng,
        ?float $dropoffLat = null,
        ?float $dropoffLng = null,
        string $serviceType = 'point_to_point',
        bool $sharingRequested = false,
        int $reservedSeats = 1,
        string $vehicleClass = 'comfort'
    ): array {
        $serviceType = $this->normalizeServiceType($serviceType);
        $sharingEligible = $serviceType === 'point_to_point';
        $sharingRequested = $sharingEligible && $sharingRequested;
        $context = ['lat' => $pickupLat, 'lng' => $pickupLng];
        $maxSharedSeats = (int) setting('ride.pricing.max_shared_seats', self::MAX_SHARED_SEATS_PER_BOOKING);
        $reservedSeats = max(1, min($maxSharedSeats, $reservedSeats));
        $distance = ($dropoffLat !== null && $dropoffLng !== null)
            ? $this->distanceKm($pickupLat, $pickupLng, (float) $dropoffLat, (float) $dropoffLng)
            : 0.0;

        $radiusKm = (float) setting('ride.dispatch.pickup_radius_km', DriverDispatchService::DEFAULT_PICKUP_RADIUS_KM, $context);
        $candidates = app(DriverDispatchService::class)->rankedCandidates(
            $this->classify($serviceType, $distance), $pickupLat, $pickupLng, limit: 200, radiusKm: $radiusKm);
        $nearbyDrivers = $candidates->count();
        $nearbyDriverLocations = $candidates->take(24)->map(fn ($row) => [
            'lat' => round((float) $row->current_lat, 5), 'lng' => round((float) $row->current_lng, 5),
        ])->values()->all();
        $nearbySharingDrivers = $sharingEligible ? $candidates->where('sharing_enabled', true)->count() : 0;
        $surgeThreshold = (int) setting('ride.pricing.surge_driver_threshold', self::SURGE_DRIVER_THRESHOLD, $context);
        $configuredSurge = (float) setting('ride.pricing.surge_multiplier', self::SURGE_MULTIPLIER, $context);
        $surgeMultiplier = $nearbyDrivers < $surgeThreshold
            ? $configuredSurge
            : 1.0;

        $vehicleMultipliers = [
            'mini' => (float) setting('ride.pricing.vehicle_multiplier_mini', self::VEHICLE_MULTIPLIERS['mini']),
            'comfort' => (float) setting('ride.pricing.vehicle_multiplier_comfort', self::VEHICLE_MULTIPLIERS['comfort']),
            'xl' => (float) setting('ride.pricing.vehicle_multiplier_xl', self::VEHICLE_MULTIPLIERS['xl']),
        ];
        $vehicleClass = array_key_exists($vehicleClass, $vehicleMultipliers) ? $vehicleClass : 'comfort';
        $vehicleMultiplier = $vehicleMultipliers[$vehicleClass];
        $baseFare = (float) setting('ride.pricing.base_fare', self::BASE_FARE, $context);
        $distanceFare = $distance * (float) setting('ride.pricing.per_km_rate', self::PER_KM_RATE, $context);
        $privateSubtotal = round(($baseFare + $distanceFare) * $surgeMultiplier * $vehicleMultiplier, 2);
        $sharedMultiplier = min(
            0.95,
            (float) setting('ride.pricing.shared_base_multiplier', self::SHARED_BASE_MULTIPLIER)
            + (($reservedSeats - 1) * (float) setting('ride.pricing.shared_extra_seat_multiplier', self::SHARED_EXTRA_SEAT_MULTIPLIER))
        );
        $subtotal = $sharingRequested
            ? round($privateSubtotal * $sharedMultiplier, 2)
            : $privateSubtotal;
        $sharingSavings = $sharingRequested ? round($privateSubtotal - $subtotal, 2) : 0.0;
        $sharingDiscountPercent = $sharingRequested ? round((1 - $sharedMultiplier) * 100, 2) : 0.0;

        return [
            'distance_km' => round($distance, 2),
            'estimated_distance_km' => round($distance, 2),
            'estimated_duration' => $distance > 0
                ? (int) ceil($distance / (float) setting('ride.pricing.avg_speed_kmh', self::AVERAGE_SPEED_KMH) * 60)
                : 30,
            'service_type' => $serviceType,
            'ride_classification' => $this->classify($serviceType, $distance),
            'vehicle_class' => $vehicleClass,
            'fare_type' => $sharingRequested ? 'flexible' : 'private',
            'fare_type_label' => $sharingRequested ? 'Flexible Fare' : 'Private Ride',
            'sharing_disclaimer' => $sharingRequested ? 'You consent to sharing and receive a discounted rate. Pooling with another rider is not guaranteed.' : null,
            'nearby_drivers' => $nearbyDrivers,
            'nearby_driver_locations' => $nearbyDriverLocations,
            'sharing' => [
                'eligible' => $sharingEligible,
                'requested' => $sharingRequested,
                'reserved_seats' => $reservedSeats,
                'nearby_sharing_drivers' => $nearbySharingDrivers,
                'can_customer_enable' => $sharingEligible,
                'enabled_by' => $sharingRequested
                    ? ($nearbySharingDrivers > 0 ? 'driver' : 'customer')
                    : null,
            ],
            'pricing' => [
                'base_fare' => $baseFare,
                'distance_fare' => round($distanceFare, 2),
                'surge_multiplier' => $surgeMultiplier,
                'vehicle_multiplier' => $vehicleMultiplier,
                'private_subtotal' => $privateSubtotal,
                'sharing_discount_percent' => $sharingDiscountPercent,
                'sharing_savings' => $sharingSavings,
                'subtotal' => $subtotal,
                'total' => $subtotal,
            ],
        ];
    }

    public function normalizeServiceType(string $serviceType): string
    {
        return $serviceType === 'hourly_rental' ? 'hourly' : $serviceType;
    }

    public function classify(string $serviceType, float $distanceKm): string
    {
        $serviceType = $this->normalizeServiceType($serviceType);

        if (in_array($serviceType, ['hourly', 'round_trip'], true)) {
            return 'long_ride';
        }

        return $distanceKm < (float) setting('ride.pricing.short_ride_threshold_km', self::SHORT_RIDE_THRESHOLD_KM)
            ? 'short_ride'
            : 'long_ride';
    }
}

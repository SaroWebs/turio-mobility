<?php

namespace App\Support\Settings;

use App\Models\ServiceZone;
use Illuminate\Support\Facades\Cache;

/**
 * Resolves a lat/lng to the most-specific active service zone.
 *
 * Pure-PHP Haversine over a cached list of zones — DB-agnostic (works the same on
 * SQLite and MySQL), mirroring the existing fallback pattern in DriverDispatchService.
 */
class ZoneResolver
{
    public const CACHE_KEY = 'settings.zones';

    /**
     * The id of the active zone that contains the point, or null if none.
     * Tiebreak for overlapping zones: higher priority, then smaller radius (more specific).
     */
    public function resolveZoneId(float $lat, float $lng): ?int
    {
        $bestId = null;
        $bestPriority = null;
        $bestRadius = null;

        foreach ($this->zones() as $zone) {
            $distance = $this->distanceKm($lat, $lng, $zone['center_lat'], $zone['center_lng']);
            if ($distance > $zone['radius_km']) {
                continue;
            }

            $moreSpecific = $bestId === null
                || $zone['priority'] > $bestPriority
                || ($zone['priority'] === $bestPriority && $zone['radius_km'] < $bestRadius);

            if ($moreSpecific) {
                $bestId = $zone['id'];
                $bestPriority = $zone['priority'];
                $bestRadius = $zone['radius_km'];
            }
        }

        return $bestId;
    }

    /**
     * @return array<int, array{id:int, center_lat:float, center_lng:float, radius_km:float, priority:int}>
     */
    public function zones(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if ($cached !== null) {
            return $cached;
        }

        try {
            $data = ServiceZone::query()
                ->where('is_active', true)
                ->get(['id', 'center_lat', 'center_lng', 'radius_km', 'priority'])
                ->map(fn (ServiceZone $z) => [
                    'id' => (int) $z->id,
                    'center_lat' => (float) $z->center_lat,
                    'center_lng' => (float) $z->center_lng,
                    'radius_km' => (float) $z->radius_km,
                    'priority' => (int) $z->priority,
                ])->all();
        } catch (\Throwable $e) {
            // Table not migrated yet — behave as if no zones exist; don't cache the failure.
            return [];
        }

        Cache::forever(self::CACHE_KEY, $data);

        return $data;
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}

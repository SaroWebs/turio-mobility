<?php

namespace App\Services;

class MapsProviderService
{
    public function provider(): string
    {
        return (string) $this->configValue('services.maps.provider', 'fallback');
    }

    public function estimateEtaMinutes(mixed $fromLat, mixed $fromLng, mixed $toLat, mixed $toLng): ?int
    {
        if (! $fromLat || ! $fromLng || ! $toLat || ! $toLng) {
            return null;
        }

        $distanceKm = $this->distanceKm((float) $fromLat, (float) $fromLng, (float) $toLat, (float) $toLng);

        return max(1, (int) ceil(($distanceKm / $this->fallbackAverageSpeedKmh()) * 60));
    }

    public function distanceKm(float $fromLat, float $fromLng, float $toLat, float $toLng): float
    {
        $earthRadiusKm = 6371;
        $latDelta = deg2rad($toLat - $fromLat);
        $lngDelta = deg2rad($toLng - $fromLng);
        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($fromLat)) * cos(deg2rad($toLat)) * sin($lngDelta / 2) ** 2;

        return $earthRadiusKm * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function fallbackAverageSpeedKmh(): int
    {
        return max(1, (int) $this->configValue('services.maps.fallback_average_speed_kmh', 28));
    }

    private function configValue(string $key, mixed $default): mixed
    {
        try {
            return function_exists('config') ? config($key, $default) : $default;
        } catch (\Throwable) {
            return $default;
        }
    }
}

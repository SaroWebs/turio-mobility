<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class PoolingRouter
{
    private array $memo = [];

    private ?float $started = null;

    /** Road routes only. Never replace a provider failure with straight-line estimates. */
    public function leg(array $from, array $to): ?array
    {
        if (SharedRidePlanner::distance($from, $to) < 5) {
            return ['meters' => 0, 'seconds' => 0, 'geometry' => [$from, $to]];
        }
        $key = json_encode([$from['lat'], $from['lng'], $to['lat'], $to['lng']]);
        if (array_key_exists($key, $this->memo)) {
            return $this->memo[$key];
        }
        $this->started ??= microtime(true);
        if (microtime(true) - $this->started > 10) {
            return null;
        }
        try {
            $google = config('services.maps.google_api_key') ?: config('services.google_maps.api_key');
            if ($google) {
                $point = fn ($p) => ['location' => ['latLng' => ['latitude' => $p['lat'], 'longitude' => $p['lng']]]];
                $response = Http::timeout(5)->withHeaders([
                    'X-Goog-Api-Key' => $google,
                    'X-Goog-FieldMask' => 'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring',
                ])->post('https://routes.googleapis.com/directions/v2:computeRoutes', [
                    'origin' => $point($from), 'destination' => $point($to),
                    'travelMode' => 'DRIVE', 'routingPreference' => 'TRAFFIC_AWARE',
                    'polylineEncoding' => 'GEO_JSON_LINESTRING',
                ]);
                $r = $response->json('routes.0');
                $coords = data_get($r, 'polyline.geoJsonLinestring.coordinates');
                $meters = data_get($r, 'distanceMeters');
                $seconds = (float) rtrim((string) data_get($r, 'duration'), 's');
            } elseif ($base = config('pooling.osrm_url')) {
                $response = Http::timeout(5)->get(rtrim($base, '/')."/route/v1/driving/{$from['lng']},{$from['lat']};{$to['lng']},{$to['lat']}", ['overview' => 'full', 'geometries' => 'geojson']);
                $r = $response->json('routes.0');
                $coords = data_get($r, 'geometry.coordinates');
                $meters = data_get($r, 'distance');
                $seconds = data_get($r, 'duration');
            } else {
                return null;
            }
            if (! $response->successful() || ! is_array($coords) || count($coords) < 2 || ! is_numeric($meters) || $seconds <= 0) {
                return $this->memo[$key] = null;
            }

            return $this->memo[$key] = ['meters' => (float) $meters, 'seconds' => (int) ceil($seconds),
                'geometry' => array_map(fn ($p) => ['lat' => (float) $p[1], 'lng' => (float) $p[0]], $coords)];
        } catch (\Throwable $e) {
            report($e);

            return $this->memo[$key] = null;
        }
    }
}

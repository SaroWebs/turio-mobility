<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Destination;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class LocationController extends Controller
{
    /**
     * Search locations using Google Places API or local destinations.
     */
    public function search(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|min:2|max:100',
            'lat' => 'sometimes|numeric|between:-90,90',
            'lng' => 'sometimes|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $query = $request->input('query');
        $cacheKey = 'public_location_search:'.sha1(mb_strtolower(trim($query)));
        if (Cache::has($cacheKey)) {
            return response()->json(['results' => Cache::get($cacheKey)]);
        }

        $results = [];

        // First, search in local destinations
        $localDestinations = Destination::active()
            ->where(function ($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                    ->orWhere('state', 'like', "%{$query}%")
                    ->orWhere('description', 'like', "%{$query}%");
            })
            ->limit(5)
            ->get()
            ->map(function ($destination) {
                return [
                    'id' => $destination->id,
                    'name' => $destination->name,
                    'address' => $destination->name.', '.$destination->state,
                    'type' => 'destination',
                    'lat' => $destination->latitude ?? null,
                    'lng' => $destination->longitude ?? null,
                ];
            });

        $results = $localDestinations->toArray();

        // Local destinations are authoritative and should return immediately.
        // Waiting for external providers merely to fill five suggestions made
        // common searches feel unavailable when those providers were slow.
        if ($results !== []) {
            Cache::put($cacheKey, $results, now()->addMinutes(10));

            return response()->json(['results' => $results]);
        }

        // If Google Maps API key is available, search Google Places Autocomplete
        $googleApiKey = config('services.google_maps.api_key') ?: env('GOOGLE_MAPS_API_KEY');

        if ($googleApiKey && count($results) < 5) {
            try {
                // Use Autocomplete API — better for partial queries like "Guw", faster and cheaper than Text Search
                $googleResponse = $this->placesRequest()->get('https://maps.googleapis.com/maps/api/place/autocomplete/json', [
                    'input' => $query,
                    'key' => $googleApiKey,
                    'components' => 'country:in', // Restrict to India
                    'language' => 'en',
                    'types' => 'geocode', // cities, regions, addresses
                ]);

                if ($googleResponse->successful()) {
                    $googleData = $googleResponse->json();
                    $status = $googleData['status'] ?? 'UNKNOWN';

                    if ($status === 'OK' && isset($googleData['predictions'])) {
                        $needed = 5 - count($results);
                        $googleResults = collect($googleData['predictions'])
                            ->take($needed)
                            ->map(function ($prediction) {
                                return [
                                    'id' => $prediction['place_id'],
                                    'name' => $prediction['structured_formatting']['main_text'] ?? $prediction['description'],
                                    'address' => $prediction['description'] ?? '',
                                    'type' => 'google_place',
                                    'lat' => null, // Resolve via place-details endpoint if needed
                                    'lng' => null,
                                ];
                            });

                        $results = array_merge($results, $googleResults->toArray());

                    } elseif ($status === 'REQUEST_DENIED') {
                        \Log::warning('Google Places API REQUEST_DENIED — billing may not be enabled. Enable billing at https://console.cloud.google.com/billing');

                    } elseif (! in_array($status, ['ZERO_RESULTS', 'OK'])) {
                        \Log::warning("Google Places API returned status: {$status}");
                    }
                }
            } catch (\Exception $e) {
                // Log error but continue with local results — never block the response
                \Log::warning('Google Places API error: '.$e->getMessage());
            }
        }

        // Fallback: If results are still low (< 5), try Photon (OpenStreetMap)
        if (count($results) < 5) {
            try {
                $photonResponse = $this->placesRequest()->get('https://photon.komoot.io/api/', [
                    'q' => $query,
                    'limit' => 5 - count($results),
                ]);

                if ($photonResponse->successful()) {
                    $photonData = $photonResponse->json();
                    if (isset($photonData['features'])) {
                        $photonResults = collect($photonData['features'])
                            ->map(function ($feature) {
                                $props = $feature['properties'];
                                $coords = $feature['geometry']['coordinates'];

                                // Format name: Name + City/State
                                $nameParts = array_filter([
                                    $props['name'] ?? null,
                                    $props['city'] ?? $props['state'] ?? null,
                                ]);

                                $addressLine = array_filter([
                                    $props['name'] ?? null,
                                    $props['street'] ?? null,
                                    $props['city'] ?? null,
                                    $props['state'] ?? null,
                                    $props['country'] ?? null,
                                ]);

                                return [
                                    'id' => 'osm_'.($props['osm_id'] ?? uniqid()),
                                    'name' => implode(', ', $nameParts),
                                    'address' => implode(', ', $addressLine),
                                    'type' => 'osm_place',
                                    'lat' => $coords[1] ?? null,
                                    'lng' => $coords[0] ?? null,
                                ];
                            });

                        $results = array_merge($results, $photonResults->toArray());
                    }
                }
            } catch (\Exception $e) {
                \Log::warning('Photon API error: '.$e->getMessage());
            }
        }

        Cache::put($cacheKey, $results, now()->addMinutes(10));

        return response()->json(['results' => $results]);
    }

    /**
     * Get popular destinations.
     */
    public function popular(Request $request)
    {
        $destinations = Destination::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->limit(10)
            ->get()
            ->map(function ($destination) {
                return [
                    'id' => $destination->id,
                    'name' => $destination->name,
                    'address' => $destination->name.', '.$destination->state,
                    'type' => 'destination',
                    'lat' => $destination->latitude ?? null,
                    'lng' => $destination->longitude ?? null,
                    'image' => $destination->cover_image ?? null,
                ];
            });

        return response()->json(['destinations' => $destinations]);
    }

    /**
     * Validate if a location is within service area.
     */
    public function validateLocation(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Define service area boundaries (example for Northeast India)
        $serviceArea = [
            'north' => 28.0,  // Northern boundary
            'south' => 20.0,  // Southern boundary
            'east' => 97.0,   // Eastern boundary
            'west' => 88.0,   // Western boundary
        ];

        $isWithinServiceArea = $request->lat >= $serviceArea['south'] &&
            $request->lat <= $serviceArea['north'] &&
            $request->lng >= $serviceArea['west'] &&
            $request->lng <= $serviceArea['east'];

        // Check if location is near any active destination (within 50km)
        $nearDestination = Destination::active()
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get()
            ->filter(function ($destination) use ($request) {
                $distance = $this->calculateDistance(
                    $request->lat,
                    $request->lng,
                    $destination->latitude,
                    $destination->longitude
                );

                return $distance <= 50; // Within 50km of any destination
            })
            ->isNotEmpty();

        $isValid = $isWithinServiceArea || $nearDestination;

        return response()->json([
            'valid' => $isValid,
            'within_service_area' => $isWithinServiceArea,
            'near_destination' => $nearDestination,
            'message' => $isValid ? 'Location is within service area' : 'Location is outside service area',
        ]);
    }

    /**
     * Get place details from Google Places API.
     */
    public function placeDetails(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'place_id' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $googleApiKey = config('services.google_maps.api_key') ?: env('GOOGLE_MAPS_API_KEY');

        if (! $googleApiKey) {
            return response()->json(['message' => 'Location search is temporarily unavailable. Please try again later.'], 503);
        }

        try {
            $response = $this->placesRequest()->get('https://maps.googleapis.com/maps/api/place/details/json', [
                'place_id' => $request->place_id,
                'fields' => 'place_id,name,formatted_address,geometry',
                'key' => $googleApiKey,
            ]);

            if ($response->successful()) {
                $data = $response->json();

                if (($data['status'] ?? null) === 'OK' && isset($data['result']['geometry']['location']['lat'], $data['result']['geometry']['location']['lng'])) {
                    $place = $data['result'];

                    return response()->json([
                        'id' => $place['place_id'],
                        'name' => $place['name'],
                        'address' => $place['formatted_address'],
                        'lat' => $place['geometry']['location']['lat'],
                        'lng' => $place['geometry']['location']['lng'],
                    ]);
                }
            }

            $status = $response->json('status');
            if (in_array($status, ['NOT_FOUND', 'ZERO_RESULTS', 'INVALID_REQUEST'], true)) {
                return response()->json(['message' => 'Location not found. Please search again.'], 404);
            }

            Log::warning('Place details provider unavailable.', ['http_status' => $response->status(), 'provider_status' => $status]);

            return response()->json(['message' => 'Location details are temporarily unavailable. Please try again.'], 503);

        } catch (\Exception $e) {
            // Exception messages can contain the request URL and its API key.
            Log::warning('Place details request failed.', ['exception' => get_class($e)]);

            return response()->json(['message' => 'Location details are temporarily unavailable. Please try again.'], 503);
        }
    }

    private function placesRequest(): PendingRequest
    {
        $request = Http::connectTimeout(3)->timeout(8);

        // Windows PHP often has no PEM bundle configured. Use the OS trust store
        // in that case, preserving TLS verification instead of bypassing it.
        if (PHP_OS_FAMILY === 'Windows' && ! ini_get('curl.cainfo') && defined('CURLSSLOPT_NATIVE_CA')) {
            $request = $request->withOptions(['curl' => [CURLOPT_SSL_OPTIONS => CURLSSLOPT_NATIVE_CA]]);
        }

        return $request;
    }

    /**
     * Return road-following route geometry for the customer map.
     */
    public function directions(Request $request)
    {
        $validated = $request->validate([
            'origin_lat' => 'required|numeric|between:-90,90',
            'origin_lng' => 'required|numeric|between:-180,180',
            'destination_lat' => 'required|numeric|between:-90,90',
            'destination_lng' => 'required|numeric|between:-180,180',
        ]);

        $googleApiKey = config('services.maps.google_api_key')
            ?: config('services.google_maps.api_key');

        if ($googleApiKey) {
            try {
                $http = Http::timeout(10);
                if (app()->environment('local')) {
                    $http = $http->withoutVerifying();
                }

                $response = $http
                    ->withHeaders([
                        'X-Goog-Api-Key' => $googleApiKey,
                        'X-Goog-FieldMask' => 'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring',
                    ])
                    ->post('https://routes.googleapis.com/directions/v2:computeRoutes', [
                        'origin' => ['location' => ['latLng' => [
                            'latitude' => (float) $validated['origin_lat'],
                            'longitude' => (float) $validated['origin_lng'],
                        ]]],
                        'destination' => ['location' => ['latLng' => [
                            'latitude' => (float) $validated['destination_lat'],
                            'longitude' => (float) $validated['destination_lng'],
                        ]]],
                        'travelMode' => 'DRIVE',
                        'routingPreference' => 'TRAFFIC_AWARE',
                        'polylineQuality' => 'OVERVIEW',
                        'polylineEncoding' => 'GEO_JSON_LINESTRING',
                    ]);

                $route = $response->json('routes.0');
                $coordinates = data_get($route, 'polyline.geoJsonLinestring.coordinates');

                if ($response->successful() && is_array($coordinates) && count($coordinates) >= 2) {
                    return response()->json($this->formatRouteResponse(
                        $coordinates,
                        (int) data_get($route, 'distanceMeters', 0),
                        $this->durationSeconds((string) data_get($route, 'duration', '0s')),
                        'google_routes'
                    ));
                }

                Log::warning('Google Routes API did not return route geometry.', [
                    'status' => $response->status(),
                    'error' => $response->json('error.message'),
                ]);
            } catch (\Throwable $error) {
                Log::warning('Google Routes API request failed.', ['message' => $error->getMessage()]);
            }
        }

        // Development fallback when Google Routes is unavailable or not enabled.
        try {
            $origin = $validated['origin_lng'].','.$validated['origin_lat'];
            $destination = $validated['destination_lng'].','.$validated['destination_lat'];
            $http = Http::timeout(10);
            if (app()->environment('local')) {
                $http = $http->withoutVerifying();
            }

            $response = $http->get(
                "https://router.project-osrm.org/route/v1/driving/{$origin};{$destination}",
                ['overview' => 'full', 'geometries' => 'geojson']
            );
            $route = $response->json('routes.0');
            $coordinates = data_get($route, 'geometry.coordinates');

            if ($response->successful() && is_array($coordinates) && count($coordinates) >= 2) {
                return response()->json($this->formatRouteResponse(
                    $coordinates,
                    (int) data_get($route, 'distance', 0),
                    (int) round((float) data_get($route, 'duration', 0)),
                    'osrm'
                ));
            }
        } catch (\Throwable $error) {
            Log::warning('Fallback directions request failed.', ['message' => $error->getMessage()]);
        }

        return response()->json([
            'message' => 'Road directions are temporarily unavailable.',
            'coordinates' => [],
        ], 503);
    }

    private function formatRouteResponse(array $coordinates, int $distanceMeters, int $durationSeconds, string $provider): array
    {
        return [
            'coordinates' => collect($coordinates)
                ->filter(fn ($point) => is_array($point) && count($point) >= 2)
                ->map(fn ($point) => [
                    'latitude' => (float) $point[1],
                    'longitude' => (float) $point[0],
                ])->values(),
            'distance_meters' => $distanceMeters,
            'duration_seconds' => $durationSeconds,
            'provider' => $provider,
        ];
    }

    private function durationSeconds(string $duration): int
    {
        return (int) round((float) rtrim($duration, 's'));
    }

    /**
     * Calculate distance between two points using Haversine formula.
     */
    private function calculateDistance($lat1, $lng1, $lat2, $lng2)
    {
        $earthRadius = 6371; // Earth's radius in kilometers

        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) * sin($latDelta / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($lngDelta / 2) * sin($lngDelta / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }
}

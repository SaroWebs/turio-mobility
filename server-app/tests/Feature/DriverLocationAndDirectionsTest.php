<?php

use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Services\DriverDispatchService;
use App\Services\RideEstimateService;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

it('stores the driver current location used by dispatch eligibility', function () {
    $driver = Driver::create([
        'name' => 'Location Ready Driver',
        'phone' => '8000000099',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);
    Sanctum::actingAs($driver);

    $this->postJson('/api/driver-app/tracking/location', [
        'latitude' => 26.1445,
        'longitude' => 91.7362,
        'accuracy' => 8.5,
        'is_available' => true,
    ])->assertOk()
        ->assertJsonPath('data.status', 'online')
        ->assertJsonPath('data.is_available', true);

    $this->assertDatabaseHas('driver_availabilities', [
        'driver_id' => $driver->id,
        'current_lat' => 26.1445,
        'current_lng' => 91.7362,
        'status' => 'online',
        'is_available' => true,
    ]);
});

it('shows customers the same pickup radius used by driver dispatch', function () {
    $category = \App\Models\CarCategory::firstOrCreate(['slug' => 'comfort'], [
        'name' => 'Comfort',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 1000,
        'is_active' => true,
        'base_fare' => 50,
        'per_km_rate' => 12,
    ]);

    $driver = Driver::create([
        'name' => 'Nearby Online Driver',
        'phone' => '8000000100',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_short_ride' => true,
    ]);

    \App\Models\Vehicle::create([
        'driver_id' => $driver->id,
        'car_category_id' => $category->id,
        'make' => 'Toyota',
        'model' => 'Etios',
        'year' => 2022,
        'color' => 'White',
        'fuel_type' => 'petrol',
        'seats' => 4,
        'registration_number' => 'AS-01-AB-1234',
        'approval_status' => 'approved',
        'is_active' => true,
    ]);

    DriverAvailability::create([
        'driver_id' => $driver->id,
        'status' => 'online',
        'is_available' => true,
        'last_updated' => now(),
        // Roughly 20 km north of the pickup: outside the old 5 km estimate
        // radius, but inside the dispatch radius.
        'current_lat' => 26.3242,
        'current_lng' => 91.7362,
    ]);

    expect(DriverDispatchService::DEFAULT_PICKUP_RADIUS_KM)->toBe(30.0)
        ->and(app(RideEstimateService::class)->nearbyDriverCount(26.1445, 91.7362))->toBe(1)
        ->and(app(RideEstimateService::class)->nearbyDriverLocations(26.1445, 91.7362))->toBe([
            ['lat' => 26.3242, 'lng' => 91.7362],
        ]);

    $this->postJson('/api/customer-app/public/rides/estimate', [
        'pickup_lat' => 26.1445,
        'pickup_lng' => 91.7362,
        'service_type' => 'point_to_point',
        'scheduled_at' => now()->addMinutes(10)->toISOString(),
    ])->assertOk()
        ->assertJsonPath('nearby_drivers', 1)
        ->assertJsonPath('nearby_driver_locations.0.lat', 26.3242)
        ->assertJsonPath('nearby_driver_locations.0.lng', 91.7362)
        ->assertJsonMissingPath('nearby_driver_locations.0.driver_id');
});

it('returns road route coordinates in the shape expected by react native maps', function () {
    config()->set('services.maps.google_api_key', 'test-routes-key');
    Http::fake([
        'routes.googleapis.com/*' => Http::response([
            'routes' => [[
                'distanceMeters' => 5200,
                'duration' => '840s',
                'polyline' => [
                    'geoJsonLinestring' => [
                        'coordinates' => [
                            [91.7362, 26.1445],
                            [91.7500, 26.1500],
                            [91.7800, 26.1700],
                        ],
                    ],
                ],
            ]],
        ], 200),
    ]);

    $this->postJson('/api/customer-app/public/directions', [
        'origin_lat' => 26.1445,
        'origin_lng' => 91.7362,
        'destination_lat' => 26.1700,
        'destination_lng' => 91.7800,
    ])->assertOk()
        ->assertJsonPath('provider', 'google_routes')
        ->assertJsonPath('distance_meters', 5200)
        ->assertJsonPath('duration_seconds', 840)
        ->assertJsonPath('coordinates.1.latitude', 26.15)
        ->assertJsonPath('coordinates.1.longitude', 91.75);

    Http::assertSent(fn ($request) => $request->url() === 'https://routes.googleapis.com/directions/v2:computeRoutes'
        && $request->hasHeader('X-Goog-Api-Key', 'test-routes-key')
        && $request['polylineEncoding'] === 'GEO_JSON_LINESTRING'
    );
});

<?php

use App\Models\Destination;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

it('returns and caches matching local destinations without calling external providers', function () {
    Cache::flush();
    Http::fake();

    Destination::create([
        'name' => 'Jaipur Airport',
        'slug' => 'jaipur-airport-test',
        'state' => 'Rajasthan',
        'latitude' => 26.8242,
        'longitude' => 75.8122,
        'is_active' => true,
    ]);

    $this->getJson('/api/customer-app/public/locations/search?query=Jaipur%20Airport')
        ->assertOk()
        ->assertJsonPath('results.0.name', 'Jaipur Airport');

    Destination::query()->delete();

    $this->getJson('/api/customer-app/public/locations/search?query=Jaipur%20Airport')
        ->assertOk()
        ->assertJsonPath('results.0.name', 'Jaipur Airport');

    Http::assertNothingSent();
});

it('resolves google place coordinates with certificate verification enabled', function () {
    config(['services.google_maps.api_key' => 'test-key']);
    Http::fake(function ($request, $options) {
        expect($options['verify'] ?? true)->not->toBeFalse();
        if (PHP_OS_FAMILY === 'Windows' && ! ini_get('curl.cainfo') && defined('CURLSSLOPT_NATIVE_CA')) {
            expect($options['curl'][CURLOPT_SSL_OPTIONS])->toBe(CURLSSLOPT_NATIVE_CA);
        }

        return Http::response([
            'status' => 'OK',
            'result' => [
                'place_id' => 'google-id', 'name' => 'Airport', 'formatted_address' => 'Airport, India',
                'geometry' => ['location' => ['lat' => 26.8242, 'lng' => 75.8122]],
            ],
        ]);
    });

    $this->getJson('/api/customer-app/public/locations/place-details?place_id=google-id')
        ->assertOk()->assertJsonPath('lat', 26.8242)->assertJsonPath('lng', 75.8122);

    Http::assertSent(fn ($request) => $request['place_id'] === 'google-id');
});

it('returns a retryable response when the place provider is unavailable', function () {
    config(['services.google_maps.api_key' => 'test-key']);
    Http::fake(['maps.googleapis.com/*' => Http::response(['status' => 'REQUEST_DENIED'])]);

    $this->getJson('/api/customer-app/public/locations/place-details?place_id=google-id')
        ->assertStatus(503)->assertJsonStructure(['message']);
});

it('handles place details connection failures without an internal server error', function () {
    config(['services.google_maps.api_key' => 'test-key']);
    Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('TLS failed'));

    $this->getJson('/api/customer-app/public/locations/place-details?place_id=google-id')
        ->assertStatus(503)->assertJsonStructure(['message']);
});

it('does not return a successful location without coordinates', function () {
    config(['services.google_maps.api_key' => 'test-key']);
    Http::fake(['maps.googleapis.com/*' => Http::response(['status' => 'OK', 'result' => ['name' => 'Airport']])]);

    $this->getJson('/api/customer-app/public/locations/place-details?place_id=google-id')->assertStatus(503);
});

it('distinguishes a missing place from a provider outage', function () {
    config(['services.google_maps.api_key' => 'test-key']);
    Http::fake(['maps.googleapis.com/*' => Http::response(['status' => 'NOT_FOUND'])]);

    $this->getJson('/api/customer-app/public/locations/place-details?place_id=google-id')->assertNotFound();
});

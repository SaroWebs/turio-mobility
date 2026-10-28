<?php

use App\Services\MapsProviderService;
use App\Services\WeatherProviderService;

it('estimates fallback map distance and eta without an external provider', function () {
    $service = new MapsProviderService;

    expect($service->provider())->toBe('fallback')
        ->and($service->distanceKm(28.6139, 77.2090, 28.7041, 77.1025))->toBeGreaterThan(0)
        ->and($service->estimateEtaMinutes(28.6139, 77.2090, 28.7041, 77.1025))->toBeGreaterThan(0)
        ->and($service->estimateEtaMinutes(null, 77.2090, 28.7041, 77.1025))->toBeNull();
});

it('returns a deterministic fallback weather snapshot', function () {
    $snapshot = (new WeatherProviderService)->snapshot(28.6139, 77.2090);
    $pending = (new WeatherProviderService)->snapshot(null, null);

    expect($snapshot)->toHaveKeys(['summary', 'temperature_c', 'source'])
        ->and($snapshot['source'])->toBe('fallback')
        ->and($snapshot['temperature_c'])->toBeInt()
        ->and($pending['summary'])->toBe('Location pending')
        ->and($pending['temperature_c'])->toBeNull();
});

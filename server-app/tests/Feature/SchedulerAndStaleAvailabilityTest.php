<?php

use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Services\DriverDispatchService;

/**
 * Item #7: scheduler registration + the stale-availability sweep
 * (SKY-MRD-001 §13.3). Background commands existed but nothing ran them;
 * `bootstrap/app.php` now registers a schedule, and a new sweep takes idle
 * drivers offline once their location tracking goes silent so they stop being
 * offered rides they can no longer answer.
 */
function makeAvailabilityDriver(string $phone): Driver
{
    return Driver::create([
        'name' => 'Availability Driver',
        'phone' => $phone,
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);
}

it('takes an online driver offline once their location tracking goes stale', function () {
    $driver = makeAvailabilityDriver('7000000001');

    $availability = DriverAvailability::create([
        'driver_id' => $driver->id,
        'status' => 'online',
        'is_available' => true,
        'current_lat' => 26.1445,
        'current_lng' => 91.7362,
        'last_updated' => now()->subSeconds(600),
    ]);

    $swept = app(DriverDispatchService::class)->expireStaleAvailability(300);

    expect($swept)->toBe(1);
    $availability->refresh();
    expect($availability->status)->toBe('offline')
        ->and($availability->is_available)->toBeFalse();
});

it('leaves a freshly-reporting online driver online', function () {
    $driver = makeAvailabilityDriver('7000000002');

    $availability = DriverAvailability::create([
        'driver_id' => $driver->id,
        'status' => 'online',
        'is_available' => true,
        'current_lat' => 26.1445,
        'current_lng' => 91.7362,
        'last_updated' => now()->subSeconds(30),
    ]);

    $swept = app(DriverDispatchService::class)->expireStaleAvailability(300);

    expect($swept)->toBe(0);
    $availability->refresh();
    expect($availability->status)->toBe('online')
        ->and($availability->is_available)->toBeTrue();
});

it('does not sweep drivers who are mid-service or never reported a location', function () {
    $onRide = makeAvailabilityDriver('7000000003');
    $onTour = makeAvailabilityDriver('7000000004');
    $neverReported = makeAvailabilityDriver('7000000005');

    // Mid-service statuses follow their own lifecycle even when tracking lags.
    DriverAvailability::create([
        'driver_id' => $onRide->id,
        'status' => 'on_ride',
        'is_available' => false,
        'last_updated' => now()->subHour(),
    ]);
    DriverAvailability::create([
        'driver_id' => $onTour->id,
        'status' => 'on_tour',
        'is_available' => false,
        'last_updated' => now()->subHour(),
    ]);
    // Online but never reported a location — nothing to go stale; leave it for
    // the driver to bring online with a first location ping.
    DriverAvailability::create([
        'driver_id' => $neverReported->id,
        'status' => 'online',
        'is_available' => true,
        'last_updated' => null,
    ]);

    $swept = app(DriverDispatchService::class)->expireStaleAvailability(300);

    expect($swept)->toBe(0);
    expect(DriverAvailability::where('status', 'on_ride')->count())->toBe(1)
        ->and(DriverAvailability::where('status', 'on_tour')->count())->toBe(1)
        ->and(DriverAvailability::where('driver_id', $neverReported->id)->first()->status)->toBe('online');
});

it('honours the staleness threshold passed to the sweep', function () {
    $driver = makeAvailabilityDriver('7000000006');

    DriverAvailability::create([
        'driver_id' => $driver->id,
        'status' => 'online',
        'is_available' => true,
        'last_updated' => now()->subSeconds(120),
    ]);

    // 2-minute-old ping is fresh under a 5-minute threshold...
    expect(app(DriverDispatchService::class)->expireStaleAvailability(300))->toBe(0);

    // ...but stale under a 1-minute threshold.
    expect(app(DriverDispatchService::class)->expireStaleAvailability(60))->toBe(1);
});

it('runs the stale-availability command and reports how many were swept', function () {
    $driver = makeAvailabilityDriver('7000000007');

    DriverAvailability::create([
        'driver_id' => $driver->id,
        'status' => 'online',
        'is_available' => true,
        'last_updated' => now()->subSeconds(600),
    ]);

    $this->artisan('dispatch:expire-stale-availability', ['--seconds' => 300])
        ->expectsOutputToContain('Marked 1 stale driver availability record(s) offline.')
        ->assertSuccessful();

    expect(DriverAvailability::where('driver_id', $driver->id)->first()->status)->toBe('offline');
});

it('registers the §13.3 background sweeps on the scheduler', function () {
    // schedule:list drives the same console-kernel path that applies the
    // ->withSchedule() registration in bootstrap/app.php, so it proves the
    // three sweeps are actually wired to run (not just that a schedule exists).
    $this->artisan('schedule:list')
        ->expectsOutputToContain('dispatch:expire-ride-attempts')
        ->expectsOutputToContain('dispatch:expire-stale-availability')
        ->expectsOutputToContain('outbox:drain')
        ->assertSuccessful();
});

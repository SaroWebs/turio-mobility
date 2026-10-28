<?php

use App\Services\BookingStatusService;

it('normalizes booking status aliases', function () {
    $service = new BookingStatusService;

    expect($service->normalize(BookingStatusService::RIDE, 'on_the_way'))->toBe('driver_arriving')
        ->and($service->normalize(BookingStatusService::RIDE, 'arrived'))->toBe('pickup')
        ->and($service->normalize(BookingStatusService::RIDE, 'started'))->toBe('in_transit')
        ->and($service->normalize(BookingStatusService::TOUR, 'started'))->toBe('in_progress')
        ->and($service->normalize(BookingStatusService::RENTAL, 'canceled'))->toBe('cancelled')
        ->and($service->normalize(BookingStatusService::RIDE, 'unknown'))->toBeNull();
});

it('allows and blocks ride transitions by actor', function () {
    $service = new BookingStatusService;

    expect($service->canTransition(BookingStatusService::RIDE, 'pending', 'confirmed', 'admin'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RIDE, 'confirmed', 'driver_assigned', 'admin'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RIDE, 'driver_assigned', 'driver_arriving', 'driver'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RIDE, 'pending', 'confirmed', 'driver'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::RIDE, 'in_transit', 'cancelled', 'driver'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::RIDE, 'pickup', 'in_transit', 'driver'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RIDE, 'in_transit', 'completed', 'driver'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RIDE, 'completed', 'cancelled', 'admin'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::RIDE, 'pending', 'completed', 'admin'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::RIDE, 'confirmed', 'driver_assigned', 'customer'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::RIDE, 'confirmed', 'cancelled', 'customer'))->toBeTrue();
});

it('allows and blocks tour transitions', function () {
    $service = new BookingStatusService;

    expect($service->canTransition(BookingStatusService::TOUR, 'pending', 'confirmed', 'admin'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::TOUR, 'confirmed', 'in_progress', 'admin'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::TOUR, 'in_progress', 'completed', 'admin'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::TOUR, 'pending', 'completed', 'admin'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::TOUR, 'completed', 'cancelled', 'admin'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::TOUR, 'confirmed', 'cancelled', 'customer'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::TOUR, 'confirmed', 'in_progress', 'customer'))->toBeFalse();
});

it('allows and blocks rental transitions', function () {
    $service = new BookingStatusService;

    expect($service->canTransition(BookingStatusService::RENTAL, 'pending', 'confirmed', 'admin'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RENTAL, 'confirmed', 'driver_assigned', 'admin'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RENTAL, 'driver_assigned', 'in_progress', 'driver'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RENTAL, 'driver_assigned', 'completed', 'driver'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::RENTAL, 'in_progress', 'completed', 'driver'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RENTAL, 'pending', 'completed', 'admin'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::RENTAL, 'completed', 'cancelled', 'admin'))->toBeFalse()
        ->and($service->canTransition(BookingStatusService::RENTAL, 'confirmed', 'cancelled', 'customer'))->toBeTrue()
        ->and($service->canTransition(BookingStatusService::RENTAL, 'confirmed', 'driver_assigned', 'customer'))->toBeFalse();
});

it('keeps service state definitions isolated', function () {
    $service = new BookingStatusService;

    expect($service->definition(BookingStatusService::RIDE)['states'])->toContain('pickup', 'in_transit')
        ->not->toContain('in_progress')
        ->and($service->definition(BookingStatusService::TOUR)['states'])->toContain('in_progress')
        ->not->toContain('pickup', 'driver_assigned')
        ->and($service->definition(BookingStatusService::RENTAL)['states'])->toContain('driver_assigned', 'in_progress')
        ->not->toContain('pickup', 'in_transit');
});

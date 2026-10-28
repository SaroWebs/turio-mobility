<?php

use App\Models\CarRental;
use App\Models\CarRentalReview;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\Place;
use App\Models\PlaceReview;
use App\Models\RideBooking;
use App\Models\RideBookingReview;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourBookingReview;
use App\Models\TourDriverAssignment;
use App\Models\Vehicle;
use App\Models\Wallet;
use App\Services\DriverDispatchService;
use Database\Seeders\DemoServerSeeder;

it('seeds connected demo server data idempotently', function () {
    $this->seed(DemoServerSeeder::class);
    $this->seed(DemoServerSeeder::class);

    expect(Customer::where('phone', '9001000001')->count())->toBe(1)
        ->and(Driver::where('phone', '8001000001')->count())->toBe(1)
        ->and(Vehicle::where('registration_number', 'RJ14DE1001')->count())->toBe(1)
        ->and(Tour::where('slug', 'jaipur-heritage-weekend-demo')->count())->toBe(1)
        ->and(Place::where('slug', 'amber-fort-demo')->count())->toBe(1)
        ->and(RideBooking::where('booking_number', 'RIDE-DEMO-0001')->count())->toBe(1)
        ->and(TourBooking::where('booking_number', 'TOUR-DEMO-0001')->count())->toBe(1)
        ->and(CarRental::where('booking_number', 'CAR-DEMO-0001')->count())->toBe(1)
        ->and(RideBookingReview::count())->toBeGreaterThan(0)
        ->and(TourBookingReview::count())->toBeGreaterThan(0)
        ->and(CarRentalReview::count())->toBeGreaterThan(0)
        ->and(PlaceReview::count())->toBeGreaterThan(0)
        ->and(TourDriverAssignment::count())->toBeGreaterThan(0)
        ->and(Wallet::count())->toBeGreaterThanOrEqual(6);

    $driver = Driver::where('phone', '8001000001')->firstOrFail();
    $place = Place::where('slug', 'amber-fort-demo')->firstOrFail();

    expect($driver->can_tour_lead)->toBeTrue()
        ->and($driver->can_tour_transport)->toBeTrue()
        ->and($driver->languages)->toContain('English')
        ->and($place->google_place_id)->toBe('demo-google-amber-fort')
        ->and($place->google_reviews)->not->toBeEmpty()
        ->and($place->google_photos)->not->toBeEmpty()
        ->and(app(DriverDispatchService::class)->hasActiveWorkload($driver))->toBeFalse();
});

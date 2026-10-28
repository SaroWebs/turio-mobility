<?php

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\DriverLocation;
use App\Models\RideBooking;
use App\Models\Vehicle;
use App\Services\PoolingRouter;
use App\Services\ResourceCommitmentService;
use App\Services\SharedRidePlanner;
use App\Services\SharedTripService;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

function poolingPoint(float $lng, string $label = ''): array
{
    return ['lat' => 20.0, 'lng' => $lng, 'label' => $label];
}

beforeEach(function () {
    Event::fake();
    $router = Mockery::mock(PoolingRouter::class);
    $router->shouldReceive('leg')->andReturnUsing(function ($a, $b) {
        $m = SharedRidePlanner::distance($a, $b);

        return ['meters' => $m, 'seconds' => (int) ceil($m / 10), 'geometry' => [$a, $b]];
    });
    app()->instance(PoolingRouter::class, $router);
});

function poolingFixture(int $capacity = 3): array
{
    $customer = Customer::create(['name' => 'Original', 'phone' => '9000008001', 'is_active' => true]);
    $driver = Driver::create(['name' => 'Pooling Driver', 'phone' => '8000008001', 'status' => 'active', 'is_active' => true, 'is_approved' => true, 'can_short_ride' => true]);
    $category = CarCategory::create(['name' => 'Pool Sedan', 'slug' => 'pool-sedan', 'vehicle_type' => 'sedan', 'seats' => $capacity + 1, 'base_price_per_day' => 1000, 'is_active' => true]);
    $vehicle = Vehicle::create(['driver_id' => $driver->id, 'car_category_id' => $category->id, 'registration_number' => 'POOL8001', 'make' => 'Tata', 'model' => 'Sedan', 'year' => 2025, 'color' => 'White', 'seats' => $capacity + 1, 'is_active' => true, 'approval_status' => 'approved']);
    DriverAvailability::create(['driver_id' => $driver->id, 'status' => 'on_ride', 'is_available' => false, 'sharing_enabled' => true, 'sharing_seat_capacity' => $capacity, 'current_lat' => 20, 'current_lng' => .01, 'last_updated' => now()]);
    DriverLocation::create(['driver_id' => $driver->id, 'latitude' => 20, 'longitude' => .01, 'accuracy' => 5, 'recorded_at' => now()]);
    $ride = RideBooking::create(['booking_number' => RideBooking::generateBookingNumber(), 'customer_id' => $customer->id, 'driver_id' => $driver->id, 'vehicle_id' => $vehicle->id,
        'service_type' => 'point_to_point', 'ride_mode' => 'shared', 'sharing_requested' => true, 'reserved_seats' => 1, 'customer_name' => 'Original', 'customer_phone' => $customer->phone,
        'pickup_location' => 'A', 'pickup_lat' => 20, 'pickup_lng' => 0, 'dropoff_location' => 'B', 'dropoff_lat' => 20, 'dropoff_lng' => .06,
        'scheduled_at' => now()->subMinutes(2), 'started_at' => now()->subMinute(), 'status' => 'in_transit', 'payment_method' => 'cash', 'payment_status' => 'pending', 'total_fare' => 100]);
    $trip = app(SharedTripService::class)->open($ride, $driver, true);

    return compact('customer', 'driver', 'vehicle', 'ride', 'trip');
}

function poolingRequest(float $drop = .04, int $seats = 1): array
{
    return ['pickup' => poolingPoint(.02, 'C'), 'dropoff' => poolingPoint($drop, $drop > .06 ? 'F' : 'D'), 'seats' => $seats, 'ready_at' => now()->timestamp + 30];
}

function poolingCustomer(string $phone): Customer
{
    return Customer::create(['name' => 'Joiner', 'phone' => $phone, 'is_active' => true]);
}

it('lets the first passenger withdraw and restore consent before anyone joins without changing the fare', function () {
    ['customer' => $customer, 'ride' => $ride, 'trip' => $trip, 'driver' => $driver] = poolingFixture();
    $service = app(SharedTripService::class);
    $joiner = poolingCustomer('9000008002');
    $offer = $service->search($joiner, poolingRequest())[0];
    Sanctum::actingAs($customer);
    $this->getJson("/api/customer-app/rides/{$ride->id}")->assertOk()->assertJsonPath('data.sharing_control.editable', true);
    $this->putJson("/api/customer-app/rides/{$ride->id}/sharing", ['sharing_requested' => false])
        ->assertOk()->assertJsonPath('data.sharing_requested', false)->assertJsonPath('data.ride_mode', 'private');
    expect($trip->fresh()->accepting)->toBeFalse()->and($ride->fresh()->total_fare)->toEqual(100);
    Sanctum::actingAs($joiner);
    $this->postJson('/api/customer-app/shared-rides/join', ['offer_id' => $offer['offer_id'], 'payment_method' => 'cash'])->assertStatus(409);
    expect($service->search($joiner, poolingRequest()))->toBeEmpty();
    Sanctum::actingAs($customer);
    $this->putJson("/api/customer-app/rides/{$ride->id}/sharing", ['sharing_requested' => true])
        ->assertOk()->assertJsonPath('data.sharing_requested', true);
    $service->open($ride->fresh(), $driver, false);
    expect($service->search($joiner, poolingRequest()))->toHaveCount(1);
});

it('locks consent for both passengers once a second customer joins even after they cancel', function () {
    ['customer' => $customer, 'ride' => $ride] = poolingFixture();
    $service = app(SharedTripService::class);
    $joiner = poolingCustomer('9000008002');
    $joined = $service->join($joiner, $service->search($joiner, poolingRequest())[0]['offer_id'], 'cash');
    foreach ([[$customer, $ride], [$joiner, $joined]] as [$person, $booking]) {
        Sanctum::actingAs($person);
        $this->getJson("/api/customer-app/rides/{$booking->id}")->assertOk()
            ->assertJsonPath('data.sharing_control.editable', false)->assertJsonPath('data.sharing_control.locked', true);
        $this->putJson("/api/customer-app/rides/{$booking->id}/sharing", ['sharing_requested' => false])->assertStatus(409);
    }
    app(\App\Services\BookingCancellationService::class)->cancel($joined, 'ride', 'Changed plans', null, 'customer', $joiner->id);
    Sanctum::actingAs($customer);
    $this->putJson("/api/customer-app/rides/{$ride->id}/sharing", ['sharing_requested' => false])->assertStatus(409);
    expect($ride->fresh()->sharing_requested)->toBeTrue();
});

it('allows consent on an unassigned private booking and rejects foreign or terminal ride edits', function () {
    ['customer' => $customer, 'ride' => $ride] = poolingFixture();
    $private = $ride->replicate(['booking_number', 'shared_trip_id', 'driver_id', 'vehicle_id', 'started_at']);
    $private->forceFill(['booking_number' => RideBooking::generateBookingNumber(), 'status' => 'pending', 'sharing_requested' => false, 'ride_mode' => 'private'])->save();
    Sanctum::actingAs(poolingCustomer('9000008002'));
    $this->putJson("/api/customer-app/rides/{$private->id}/sharing", ['sharing_requested' => true])->assertForbidden();
    Sanctum::actingAs($customer);
    $this->putJson("/api/customer-app/rides/{$private->id}/sharing", ['sharing_requested' => true])->assertOk();
    $this->putJson("/api/customer-app/rides/{$private->id}/sharing", ['sharing_requested' => false])->assertOk();
    $this->putJson("/api/customer-app/rides/{$private->id}/sharing", ['sharing_requested' => 'invalid'])->assertUnprocessable();
    $private->update(['status' => 'completed']);
    $this->putJson("/api/customer-app/rides/{$private->id}/sharing", ['sharing_requested' => true])->assertStatus(409);
});

it('matches and executes A-B with C-D and C-F without ending the vehicle trip at B', function () {
    ['driver' => $driver, 'ride' => $original, 'trip' => $trip] = poolingFixture();
    $service = app(SharedTripService::class);
    $second = poolingCustomer('9000008002');
    $third = poolingCustomer('9000008003');
    $offers = $service->search($second, poolingRequest());
    expect($offers)->toHaveCount(1);
    $b2 = $service->join($second, $offers[0]['offer_id'], 'cash');
    $offers = $service->search($third, poolingRequest(.08));
    expect($offers)->toHaveCount(1)->and($offers[0]['extension'])->toBeTrue();
    $b3 = $service->join($third, $offers[0]['offer_id'], 'cash');
    expect($original->fresh()->total_fare)->toEqual(100)
        ->and($service->join($third, $offers[0]['offer_id'], 'cash')->id)->toBe($b3->id);
    $stops = $service->remaining($trip->fresh());
    expect(array_column($stops, 'label'))->toBe(['C', 'C', 'D', 'B', 'F']);
    Sanctum::actingAs($driver);
    $this->postJson("/api/driver-app/tracking/ride/{$original->id}/status", ['status' => 'completed'])->assertStatus(409);
    foreach (array_slice($stops, 0, 2) as $stop) {
        $b = RideBooking::find($stop['booking_id']);
        $this->postJson("/api/driver-app/tracking/ride/{$b->id}/status", ['status' => 'on_the_way'])->assertOk();
        $this->postJson("/api/driver-app/tracking/ride/{$b->id}/status", ['status' => 'arrived'])->assertOk();
        $this->postJson("/api/driver-app/tracking/ride/{$b->id}/status", ['status' => 'started', 'start_pin' => 'wrong'])->assertStatus(422);
        $this->postJson("/api/driver-app/tracking/ride/{$b->id}/status", ['status' => 'started', 'start_pin' => $b->start_ride_pin])->assertOk();
    }
    foreach ([$b2, $original] as $b) {
        $this->postJson("/api/driver-app/tracking/ride/{$b->id}/status", ['status' => 'completed'])->assertOk();
    }
    expect($driver->driverAvailability->fresh()->is_available)->toBeFalse();
    $this->getJson('/api/driver-app/active-ride')->assertOk()->assertJsonPath('ride.id', $b3->id);
    $this->postJson("/api/driver-app/tracking/ride/{$b3->id}/status", ['status' => 'completed'])->assertOk();
    expect($driver->driverAvailability->fresh()->is_available)->toBeTrue();
});

it('rejects stale offers after a competing booking takes the last overlapping seat', function () {
    poolingFixture(2);
    $service = app(SharedTripService::class);
    $c2 = poolingCustomer('9000008002');
    $c3 = poolingCustomer('9000008003');
    $o2 = $service->search($c2, poolingRequest())[0];
    $o3 = $service->search($c3, poolingRequest(.08))[0];
    $service->join($c2, $o2['offer_id'], 'cash');
    Sanctum::actingAs($c3);
    $this->postJson('/api/customer-app/shared-rides/join', ['offer_id' => $o3['offer_id'], 'payment_method' => 'cash'])->assertStatus(409);
    expect($service->search($c3, poolingRequest(.08)))->toBeEmpty();
});

it('excludes pickups already passed, reverse journeys, stale GPS and disallowed extensions', function () {
    ['trip' => $trip] = poolingFixture();
    $service = app(SharedTripService::class);
    $c = poolingCustomer('9000008002');
    $request = poolingRequest();
    $request['pickup'] = poolingPoint(.005);
    expect($service->search($c, $request))->toBeEmpty();
    expect($service->search($c, poolingRequest(.015)))->toBeEmpty();
    $trip->update(['allow_extension' => false]);
    expect($service->search($c, poolingRequest(.08)))->toBeEmpty();
    DriverLocation::query()->update(['recorded_at' => now()->subMinutes(2)]);
    expect($service->search($c, poolingRequest()))->toBeEmpty();
});

it('rechecks vehicle progress and offer ownership at booking time', function () {
    ['driver' => $driver] = poolingFixture();
    $service = app(SharedTripService::class);
    $c = poolingCustomer('9000008002');
    $offer = $service->search($c, poolingRequest())[0];
    Sanctum::actingAs(poolingCustomer('9000008003'));
    $this->postJson('/api/customer-app/shared-rides/join', ['offer_id' => $offer['offer_id'], 'payment_method' => 'cash'])->assertStatus(409);
    DriverLocation::query()->update(['longitude' => .03]);
    Sanctum::actingAs($c);
    $this->postJson('/api/customer-app/shared-rides/join', ['offer_id' => $offer['offer_id'], 'payment_method' => 'cash'])->assertStatus(409);
    expect(RideBooking::count())->toBe(1);
});

it('rolls back a wallet failure without reserving seats and protects conflicting commitments', function () {
    ['trip' => $trip, 'driver' => $driver, 'vehicle' => $vehicle] = poolingFixture();
    $service = app(SharedTripService::class);
    $c = poolingCustomer('9000008002');
    $offer = $service->search($c, poolingRequest())[0];
    Sanctum::actingAs($c);
    $this->postJson('/api/customer-app/shared-rides/join', ['offer_id' => $offer['offer_id'], 'payment_method' => 'wallet'])->assertStatus(422);
    expect(RideBooking::count())->toBe(1)->and($trip->fresh()->version)->toBe(1);
    expect(app(ResourceCommitmentService::class)->findConflicts($driver->id, $vehicle->id, now(), now()->addHour(), ['exact_interval' => true]))->not->toBeEmpty();
});

it('releases cancelled passenger stops and keeps the remaining extension booking', function () {
    ['trip' => $trip] = poolingFixture();
    $service = app(SharedTripService::class);
    $c2 = poolingCustomer('9000008002');
    $c3 = poolingCustomer('9000008003');
    $b2 = $service->join($c2, $service->search($c2, poolingRequest())[0]['offer_id'], 'cash');
    $b3 = $service->join($c3, $service->search($c3, poolingRequest(.08))[0]['offer_id'], 'cash');
    app(\App\Services\BookingCancellationService::class)->cancel($b2, 'ride', 'Changed plans', null, 'customer', $c2->id);
    $remaining = $service->remaining($trip->fresh());
    expect(array_column($remaining, 'booking_id'))->not->toContain($b2->id)
        ->and(array_column($remaining, 'booking_id'))->toContain($b3->id);
});

it('honors immutable arrival promises and cumulative extension limits', function () {
    ['trip' => $trip] = poolingFixture();
    $service = app(SharedTripService::class);
    $c = poolingCustomer('9000008002');
    $stops = $trip->stops;
    $stops[0]['latest'] = now()->timestamp + 1;
    $trip->update(['stops' => $stops]);
    expect($service->search($c, poolingRequest()))->toBeEmpty();
    $stops[0]['latest'] = now()->addHour()->timestamp;
    $trip->update(['stops' => $stops]);
    config(['pooling.max_extension_m' => 500]);
    expect($service->search($c, poolingRequest(.08)))->toBeEmpty();
});

it('counts capacity per segment and allows a seat to be reused after dropoff', function () {
    $planner = app(SharedRidePlanner::class);
    $stops = [
        ['type' => 'pickup', 'seats' => 1], ['type' => 'dropoff', 'seats' => 1],
        ['type' => 'pickup', 'seats' => 1], ['type' => 'dropoff', 'seats' => 1], ['type' => 'dropoff', 'seats' => 1],
    ];
    expect($planner->capacity($stops, 1, 2))->toBeTrue();
    array_splice($stops, 1, 0, [['type' => 'pickup', 'seats' => 1]]);
    expect($planner->capacity($stops, 1, 2))->toBeFalse();
});

it('does not expose rides without road directions or permit extending a private ride', function () {
    ['ride' => $ride, 'driver' => $driver] = poolingFixture();
    $router = Mockery::mock(PoolingRouter::class);
    $router->shouldReceive('leg')->andReturnNull();
    app()->instance(PoolingRouter::class, $router);
    expect(app(SharedTripService::class)->search(poolingCustomer('9000008002'), poolingRequest()))->toBeEmpty();
    RideBooking::whereKey($ride->id)->update(['sharing_requested' => false]);
    Sanctum::actingAs($driver);
    $this->postJson("/api/driver-app/rides/{$ride->id}/pooling", ['accepting' => true, 'allow_extension' => true])->assertStatus(409);
});

it('offers authenticated searches without exposing other passenger information and rejects expired offers', function () {
    poolingFixture();
    $c = poolingCustomer('9000008002');
    Sanctum::actingAs($c);
    $response = $this->postJson('/api/customer-app/shared-rides/search', [
        'pickup_lat' => 20, 'pickup_lng' => .02, 'pickup_location' => 'C', 'dropoff_lat' => 20, 'dropoff_lng' => .04, 'dropoff_location' => 'D', 'seats' => 1,
    ])->assertOk()->assertJsonCount(1, 'data');
    expect($response->json('data.0'))->not->toHaveKeys(['stops', 'geometry', 'customer_phone', 'customer_name']);
    $offer = $response->json('data.0.offer_id');
    $this->travel(46)->seconds();
    $this->postJson('/api/customer-app/shared-rides/join', ['offer_id' => $offer, 'payment_method' => 'cash'])->assertStatus(409);
});

it('rejects matches when an extension conflicts with another assigned booking', function () {
    ['ride' => $ride] = poolingFixture();
    $next = $ride->replicate();
    $next->booking_number = RideBooking::generateBookingNumber();
    $next->shared_trip_id = null;
    $next->status = 'driver_assigned';
    $next->scheduled_at = now()->addMinutes(12);
    $next->started_at = null;
    $next->save();
    expect(app(SharedTripService::class)->search(poolingCustomer('9000008002'), poolingRequest(.08)))->toBeEmpty();
});

it('checks travel time to a later booking even when the calendar intervals do not overlap', function () {
    ['ride' => $ride] = poolingFixture();
    $next = $ride->replicate();
    $next->booking_number = RideBooking::generateBookingNumber();
    $next->shared_trip_id = null;
    $next->status = 'driver_assigned';
    $next->scheduled_at = now()->addHours(2);
    $next->pickup_lng = 2;
    $next->started_at = null;
    $next->save();
    expect(app(SharedTripService::class)->search(poolingCustomer('9000008002'), poolingRequest(.08)))->toBeEmpty();
});

it('charges a joined wallet booking only once across replayed requests', function () {
    poolingFixture();
    $c = poolingCustomer('9000008002');
    $wallet = \App\Models\Wallet::create(['owner_type' => Customer::class, 'owner_id' => $c->id, 'balance' => 10000, 'balance_minor' => 1000000, 'currency' => 'INR', 'is_active' => true]);
    $service = app(SharedTripService::class);
    $offer = $service->search($c, poolingRequest())[0];
    Sanctum::actingAs($c);
    $body = ['offer_id' => $offer['offer_id'], 'payment_method' => 'wallet'];
    $first = $this->postJson('/api/customer-app/shared-rides/join', $body)->assertCreated()->assertJsonPath('data.payment_status', 'paid');
    $balance = $wallet->fresh()->balance_minor;
    $this->postJson('/api/customer-app/shared-rides/join', $body)->assertCreated()->assertJsonPath('data.id', $first->json('data.id'));
    expect($wallet->fresh()->balance_minor)->toBe($balance)
        ->and($balance)->toBe(1000000 - (int) round($offer['fare'] * 100));
});

it('retains the original pickup when sharing is opened before the first passenger boards', function () {
    ['ride' => $old, 'driver' => $driver] = poolingFixture();
    $old->update(['status' => 'completed']);
    $ride = $old->replicate();
    $ride->booking_number = RideBooking::generateBookingNumber();
    $ride->shared_trip_id = null;
    $ride->status = 'driver_assigned';
    $ride->pickup_lng = .015;
    $ride->started_at = null;
    $ride->save();
    $service = app(SharedTripService::class);
    $trip = $service->open($ride, $driver, true);
    expect(array_column($trip->stops, 'type'))->toBe(['pickup', 'dropoff']);
    $customer = poolingCustomer('9000008002');
    $offer = $service->search($customer, poolingRequest(.08))[0];
    $service->join($customer, $offer['offer_id'], 'cash');
    expect(array_column($service->remaining($trip->fresh()), 'label'))->toBe(['A', 'C', 'B', 'F']);
});

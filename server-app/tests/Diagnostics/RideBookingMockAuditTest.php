<?php

// Opt-in audit: assertions describe intended behaviour, including unfixed gaps.
// Run: php artisan test tests/Diagnostics/RideBookingMockAuditTest.php
use App\Events\BookingLifecycleNotification;
use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\DriverDocument;
use App\Models\RideBooking;
use App\Models\Vehicle;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(Tests\TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    config(['broadcasting.default' => 'log']);
    Event::fake([BookingLifecycleNotification::class]);
    Http::preventStrayRequests();
    $this->customer = Customer::create(['name' => 'Mock Ride Customer', 'phone' => '9000000299', 'is_active' => true]);
    $this->driver = Driver::create([
        'name' => 'Mock Ride Driver', 'phone' => '8000000299', 'status' => 'active',
        'is_active' => true, 'is_approved' => true, 'can_short_ride' => true,
    ]);
    $category = CarCategory::create([
        'name' => 'Mock Sedan', 'slug' => 'mock-ride-sedan', 'vehicle_type' => 'sedan',
        'seats' => 4, 'base_price_per_day' => 1800, 'is_active' => true,
    ]);
    $this->vehicle = Vehicle::create([
        'driver_id' => $this->driver->id, 'car_category_id' => $category->id,
        'registration_number' => 'RJ14QA0299', 'make' => 'Maruti', 'model' => 'Ciaz',
        'year' => 2025, 'color' => 'White', 'seats' => 4,
        'is_active' => true, 'approval_status' => 'approved',
    ]);
    foreach (['driving_license', 'government_id', 'vehicle_rc'] as $type) {
        DriverDocument::create([
            'driver_id' => $this->driver->id, 'type' => $type,
            'status' => 'approved', 'file_path' => "mock/{$type}.pdf",
            'expires_at' => today()->addYear(),
        ]);
    }
    $this->payload = [
        'service_type' => 'point_to_point', 'pickup_location' => 'Mock Jaipur pickup',
        'pickup_lat' => 26.8242, 'pickup_lng' => 75.8122,
        'dropoff_location' => 'Mock Jaipur destination', 'dropoff_lat' => 26.9855, 'dropoff_lng' => 75.8513,
        'scheduled_at' => now()->addMinutes(5)->toISOString(), 'request_mode' => 'immediate',
        'payment_method' => 'cash', 'vehicle_class' => 'comfort',
    ];
    Sanctum::actingAs($this->driver->fresh());
    $this->putJson('/api/driver-app/availability', ['is_online' => true, 'is_available' => true])->assertOk();
    $this->postJson('/api/driver-app/tracking/location', [
        'latitude' => 26.8242, 'longitude' => 75.8122, 'is_available' => true,
    ])->assertOk();
    Sanctum::actingAs($this->customer);
});

it('completes estimate to receipt using customer-visible PIN and app status payloads', function (string $method) {
    $wallet = Wallet::create([
        'owner_type' => Customer::class, 'owner_id' => $this->customer->id,
        'balance' => 10000, 'balance_minor' => 1000000, 'currency' => 'INR', 'is_active' => true,
    ]);
    $payload = [...$this->payload, 'payment_method' => $method];
    $estimate = $this->postJson('/api/customer-app/public/rides/estimate', $payload)->assertOk();
    $key = ['Idempotency-Key' => 'mock-ride-'.$method];
    $created = $this->postJson('/api/customer-app/rides', $payload, $key)->assertCreated();
    $id = $created->json('data.id');
    expect((float) $created->json('data.total_fare'))->toBe((float) $estimate->json('pricing.total'));
    $this->postJson('/api/customer-app/rides', $payload, $key)->assertCreated()->assertJsonPath('data.id', $id);
    expect(RideBooking::count())->toBe(1);

    Sanctum::actingAs($this->driver->fresh());
    $this->getJson('/api/driver-app/pending-rides')->assertOk()->assertJsonPath('rides.0.id', $id);
    $this->postJson("/api/driver-app/rides/{$id}/accept")->assertOk()->assertJsonPath('ride.status', 'driver_assigned');
    $this->getJson('/api/driver-app/active-ride')->assertOk()->assertJsonPath('ride.id', $id);
    $this->postJson("/api/driver-app/tracking/ride/{$id}/status", ['status' => 'completed'])->assertStatus(400);
    $this->postJson("/api/driver-app/tracking/ride/{$id}/status", ['status' => 'on_the_way'])->assertOk();
    $this->postJson("/api/driver-app/tracking/ride/{$id}/status", ['status' => 'arrived'])->assertOk();

    Sanctum::actingAs($this->customer);
    $tracking = $this->getJson("/api/customer-app/tracking/ride/{$id}")->assertOk();
    $pin = $tracking->json('data.start_verification.code');
    expect($pin)->not->toBeNull();
    Sanctum::actingAs($this->driver->fresh());
    $wrongPin = $pin === '0000' ? '0001' : '0000';
    $this->postJson("/api/driver-app/tracking/ride/{$id}/status", ['status' => 'started', 'start_pin' => $wrongPin])->assertStatus(422);
    $this->postJson("/api/driver-app/tracking/ride/{$id}/status", ['status' => 'started', 'start_pin' => $pin])->assertOk();
    $this->postJson('/api/driver-app/tracking/location', [
        'latitude' => 26.9855, 'longitude' => 75.8513, 'service_type' => 'ride', 'booking_id' => $id,
    ])->assertOk();
    $this->postJson("/api/driver-app/tracking/ride/{$id}/status", [
        'status' => 'completed', 'cash_received' => $method === 'cash',
    ])->assertOk()->assertJsonPath('data.payment_status', 'paid');
    $this->getJson('/api/driver-app/history')->assertOk();
    expect(DriverAvailability::where('driver_id', $this->driver->id)->first()->is_available)->toBeTrue();

    Sanctum::actingAs($this->customer);
    $this->getJson("/api/customer-app/tracking/ride/{$id}")->assertOk()
        ->assertJsonPath('data.booking.status', 'completed')->assertJsonPath('data.status_steps.4.done', true);
    $this->getJson('/api/customer-app/rides')->assertOk();
    $this->postJson("/api/customer-app/rides/{$id}/review", ['rating' => 5, 'comment' => 'Mock audit'])->assertSuccessful();
    $expectedBalance = 10000.0 - ($method === 'wallet' ? (float) $created->json('data.total_fare') : 0);
    expect((float) $wallet->fresh()->balance)->toBe($expectedBalance);
})->with(['cash', 'wallet']);

it('does not offer an XL request to a four-seat sedan', function () {
    $this->postJson('/api/customer-app/rides', [...$this->payload, 'vehicle_class' => 'xl'])
        ->assertCreated()->assertJsonPath('dispatch.candidate_count', 0);
});

it('blocks dispatch after an online drivers licence expires', function () {
    $this->driver->documents()->where('type', 'driving_license')->update(['expires_at' => today()->subDay()]);
    $this->postJson('/api/customer-app/rides', $this->payload)->assertCreated()->assertJsonPath('dispatch.candidate_count', 0);
});

it('does not let a location heartbeat bypass document readiness', function () {
    DriverAvailability::where('driver_id', $this->driver->id)->delete();
    $this->driver->documents()->delete();
    Sanctum::actingAs($this->driver->fresh());
    $this->putJson('/api/driver-app/availability', ['is_online' => true, 'is_available' => true])->assertStatus(422);
    $this->postJson('/api/driver-app/tracking/location', [
        'latitude' => 26.8242, 'longitude' => 75.8122, 'is_available' => true,
    ])->assertOk();
    expect(DriverAvailability::where('driver_id', $this->driver->id)->first()->is_available)->toBeFalse();
});

it('keeps ride transitions available when the realtime provider fails', function () {
    $id = $this->postJson('/api/customer-app/rides', $this->payload)->assertCreated()->json('data.id');
    Sanctum::actingAs($this->driver->fresh());
    $this->postJson("/api/driver-app/rides/{$id}/accept")->assertOk();
    app(Illuminate\Contracts\Broadcasting\Factory::class)->extend('mock-outage', function () {
        $broadcaster = Mockery::mock(Illuminate\Broadcasting\Broadcasters\LogBroadcaster::class);
        $broadcaster->shouldReceive('broadcast')->andThrow(new RuntimeException('Mock realtime provider unavailable'));
        return $broadcaster;
    });
    config(['broadcasting.default' => 'mock-outage', 'broadcasting.connections.mock-outage' => ['driver' => 'mock-outage']]);
    $response = $this->postJson("/api/driver-app/tracking/ride/{$id}/status", ['status' => 'on_the_way']);
    expect(RideBooking::findOrFail($id)->status)->toBe('driver_arriving');
    $response->assertOk()->assertJsonPath('data.status', 'driver_arriving');
});

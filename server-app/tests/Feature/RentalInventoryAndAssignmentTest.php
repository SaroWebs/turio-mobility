<?php

use App\Events\BookingLifecycleNotification;
use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\DriverLocation;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\RazorpayService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Event::fake([BookingLifecycleNotification::class]);
    config([
        'services.razorpay.booking_checkout_enabled' => true,
        'services.razorpay.key' => 'rzp_test_key_123',
        'services.razorpay.secret' => 'rzp_test_secret_123',
    ]);

    $mock = Mockery::mock(RazorpayService::class);
    $mock->shouldReceive('createOrder')->andReturnUsing(function ($amount, $orderNumber, $notes) {
        return [
            'id' => 'order_rent_mock_'.uniqid(),
            'amount' => (int) round($amount * 100),
            'currency' => 'INR',
            'status' => 'created',
        ];
    })->byDefault();
    app()->instance(RazorpayService::class, $mock);

    $this->admin = User::factory()->create([
        'name' => 'Admin Manager',
        'email' => 'admin.rental@example.com',
    ]);
    Role::firstOrCreate(['name' => 'admin', 'display_name' => 'Admin']);
    $this->admin->assignRole('admin');

    $this->customer = Customer::create([
        'name' => 'Alice Customer',
        'email' => 'alice@example.com',
        'phone' => '9900112233',
        'is_active' => true,
    ]);

    $this->category = CarCategory::create([
        'name' => 'Executive Sedan',
        'slug' => 'executive-sedan',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 2000,
        'included_km_per_day' => 120,
        'extra_km_charge' => 12,
        'is_active' => true,
    ]);

    $this->driver1 = Driver::create([
        'name' => 'Driver One',
        'phone' => '9888111001',
        'email' => 'driver1@example.com',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_rental_delivery' => true,
        'rating' => 4.9,
    ]);

    DriverAvailability::create([
        'driver_id' => $this->driver1->id,
        'is_available' => true,
        'status' => 'online',
        'last_updated' => now(),
    ]);

    $this->vehicle1 = Vehicle::create([
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver1->id,
        'registration_number' => 'KA01EXEC01',
        'make' => 'Honda',
        'model' => 'City',
        'year' => 2023,
        'color' => 'White',
        'fuel_type' => 'petrol',
        'seats' => 4,
        'is_ac' => true,
        'is_active' => true,
        'approval_status' => 'approved',
        'condition' => 'good',
        'is_available_for_rent' => true,
    ]);

    $this->driver2 = Driver::create([
        'name' => 'Driver Two',
        'phone' => '9888111002',
        'email' => 'driver2@example.com',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_rental_delivery' => true,
        'rating' => 4.5,
    ]);

    DriverAvailability::create([
        'driver_id' => $this->driver2->id,
        'is_available' => true,
        'status' => 'online',
        'last_updated' => now(),
    ]);

    $this->vehicle2 = Vehicle::create([
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver2->id,
        'registration_number' => 'KA01EXEC02',
        'make' => 'Hyundai',
        'model' => 'Verna',
        'year' => 2023,
        'color' => 'Silver',
        'fuel_type' => 'petrol',
        'seats' => 4,
        'is_ac' => true,
        'is_active' => true,
        'approval_status' => 'approved',
        'condition' => 'good',
        'is_available_for_rent' => true,
    ]);
});

function createTestRental(array $attributes = []): CarRental
{
    $start = $attributes['start_date'] ?? today()->addDays(2)->toDateString();
    $end = $attributes['end_date'] ?? today()->addDays(4)->toDateString();
    $days = \Carbon\Carbon::parse($start)->diffInDays(\Carbon\Carbon::parse($end)) + 1;

    return CarRental::create(array_merge([
        'customer_name' => 'Alice Customer',
        'customer_email' => 'alice@example.com',
        'customer_phone' => '9900112233',
        'number_of_days' => $days,
        'pickup_location' => 'Bangalore',
        'base_price' => 2000,
        'total_price' => 5000,
        'status' => 'pending',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
        'start_date' => $start,
        'end_date' => $end,
    ], $attributes));
}

it('computes category availability across date ranges based on vehicle inventory and conflicting bookings (G-40)', function () {
    Sanctum::actingAs($this->customer);

    $start = today()->addDays(5)->toDateString();
    $end = today()->addDays(7)->toDateString();

    // Initially both vehicles in category are available
    $res = $this->getJson("/api/customer-app/car-categories?start_date={$start}&end_date={$end}")
        ->assertOk()
        ->json('data');

    $catData = collect($res)->firstWhere('id', $this->category->id);
    expect($catData)->not->toBeNull()
        ->and($catData['total_vehicles'])->toBe(2)
        ->and($catData['available_vehicles'])->toBe(2)
        ->and($catData['is_available'])->toBeTrue();

    // Create a confirmed booking occupying vehicle1 for that date range
    createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
        'start_date' => $start,
        'end_date' => $end,
        'status' => 'driver_assigned',
        'payment_status' => 'paid',
    ]);

    $res2 = $this->getJson("/api/customer-app/car-categories?start_date={$start}&end_date={$end}")
        ->assertOk()
        ->json('data');

    $catData2 = collect($res2)->firstWhere('id', $this->category->id);
    expect($catData2['total_vehicles'])->toBe(2)
        ->and($catData2['available_vehicles'])->toBe(1)
        ->and($catData2['is_available'])->toBeTrue();

    // Also book vehicle2 for overlapping dates
    createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver2->id,
        'vehicle_id' => $this->vehicle2->id,
        'start_date' => $start,
        'end_date' => $end,
        'status' => 'driver_assigned',
        'payment_status' => 'paid',
    ]);

    $res3 = $this->getJson("/api/customer-app/car-categories?start_date={$start}&end_date={$end}")
        ->assertOk()
        ->json('data');

    $catData3 = collect($res3)->firstWhere('id', $this->category->id);
    expect($catData3['total_vehicles'])->toBe(2)
        ->and($catData3['available_vehicles'])->toBe(0)
        ->and($catData3['is_available'])->toBeFalse();
});

it('creates rental with temporary hold_expires_at for electronic payment (G-40)', function () {
    Sanctum::actingAs($this->customer);

    $payload = [
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(2)->toDateString(),
        'end_date' => today()->addDays(4)->toDateString(),
        'pickup_location' => 'MG Road, Bangalore',
        'payment_method' => 'card',
    ];

    $response = $this->postJson('/api/customer-app/car-rentals', $payload)
        ->assertCreated();

    $rentalId = $response->json('data.id');
    $rental = CarRental::findOrFail($rentalId);

    expect($rental->hold_expires_at)->not->toBeNull()
        ->and($rental->hold_expires_at->gt(now()))
        ->and($rental->hold_expires_at->diffInMinutes(now()))->toBeLessThanOrEqual(30)
        ->and($rental->payment_status)->toBe('pending');
});

it('blocks double booking while hold is active (G-40)', function () {
    Sanctum::actingAs($this->customer);

    $start = today()->addDays(3)->toDateString();
    $end = today()->addDays(5)->toDateString();

    // Create 2 online payment rentals holding both vehicles
    $res1 = $this->postJson('/api/customer-app/car-rentals', [
        'car_category_id' => $this->category->id,
        'start_date' => $start,
        'end_date' => $end,
        'pickup_location' => 'Koramangala',
        'payment_method' => 'card',
    ])->assertCreated();

    $res2 = $this->postJson('/api/customer-app/car-rentals', [
        'car_category_id' => $this->category->id,
        'start_date' => $start,
        'end_date' => $end,
        'pickup_location' => 'Koramangala',
        'payment_method' => 'card',
    ])->assertCreated();

    // 3rd booking attempt must fail because all vehicles have active holds
    $res3 = $this->postJson('/api/customer-app/car-rentals', [
        'car_category_id' => $this->category->id,
        'start_date' => $start,
        'end_date' => $end,
        'pickup_location' => 'Koramangala',
        'payment_method' => 'card',
    ])->assertStatus(422);

    expect($res3->json('message'))->toContain('No car and driver are available');
});

it('permits booking same vehicle once hold expires without payment (G-40)', function () {
    Sanctum::actingAs($this->customer);

    $start = today()->addDays(3)->toDateString();
    $end = today()->addDays(5)->toDateString();

    // Book vehicle 1 and 2 with expired holds
    createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
        'start_date' => $start,
        'end_date' => $end,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
        'payment_method' => 'card',
        'hold_expires_at' => now()->subMinute(), // Expired hold!
    ]);

    createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver2->id,
        'vehicle_id' => $this->vehicle2->id,
        'start_date' => $start,
        'end_date' => $end,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
        'payment_method' => 'card',
        'hold_expires_at' => now()->subMinute(), // Expired hold!
    ]);

    // ResourceCommitmentService ignores expired holds, so a new booking succeeds!
    $res = $this->postJson('/api/customer-app/car-rentals', [
        'car_category_id' => $this->category->id,
        'start_date' => $start,
        'end_date' => $end,
        'pickup_location' => 'Koramangala',
        'payment_method' => 'cash',
    ])->assertCreated();

    expect($res->json('data.id'))->not->toBeNull();
});

it('sweeps and cancels expired rental holds via rentals:expire-holds command (G-40)', function () {
    $expiredRental = createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
        'payment_method' => 'card',
        'hold_expires_at' => now()->subMinutes(5),
    ]);

    $activeRental = createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver2->id,
        'vehicle_id' => $this->vehicle2->id,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
        'payment_method' => 'card',
        'hold_expires_at' => now()->addMinutes(25),
    ]);

    Artisan::call('rentals:expire-holds');

    expect($expiredRental->fresh()->status)->toBe('cancelled')
        ->and($expiredRental->fresh()->cancellation_reason)->toContain('Rental hold expired')
        ->and($activeRental->fresh()->status)->toBe('driver_assigned');
});

it('returns ranked eligible driver and vehicle candidates for rental booking (G-41)', function () {
    // Add locations for drivers
    DriverLocation::create([
        'driver_id' => $this->driver1->id,
        'latitude' => 12.9716, // Near Bangalore MG Road
        'longitude' => 77.5946,
        'recorded_at' => now(),
    ]);

    DriverLocation::create([
        'driver_id' => $this->driver2->id,
        'latitude' => 13.0827, // Farther away (e.g. Hebbal / Chennai latitude)
        'longitude' => 80.2707,
        'recorded_at' => now(),
    ]);

    $rental = createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(5)->toDateString(),
        'end_date' => today()->addDays(7)->toDateString(),
        'pickup_location' => 'MG Road Metro Station',
        'pickup_lat' => 12.9750,
        'pickup_lng' => 77.6000,
        'status' => 'pending',
        'payment_status' => 'pending',
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson("/admin/car-rentals/{$rental->id}/candidates")
        ->assertOk();

    $candidates = $response->json('data');
    expect($candidates)->toHaveCount(2)
        // Driver 1 is closer (~0.7 km) so should rank first
        ->and($candidates[0]['driver']['id'])->toBe($this->driver1->id)
        ->and($candidates[0]['distance_km'])->not->toBeNull()
        ->and($candidates[1]['driver']['id'])->toBe($this->driver2->id);
});

it('assigns driver to car rental and emits notifications to customer and driver (G-41)', function () {
    $rental = createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'start_date' => today()->addDays(5)->toDateString(),
        'end_date' => today()->addDays(7)->toDateString(),
        'status' => 'pending',
        'payment_status' => 'pending',
    ]);

    $response = $this->actingAs($this->admin)
        ->postJson("/admin/car-rentals/{$rental->id}/assign-driver", [
            'driver_id' => $this->driver1->id,
            'vehicle_id' => $this->vehicle1->id,
        ])
        ->assertOk();

    expect($rental->fresh()->driver_id)->toBe($this->driver1->id)
        ->and($rental->fresh()->vehicle_id)->toBe($this->vehicle1->id)
        ->and($rental->fresh()->status)->toBe('driver_assigned');

    // Customer notification: driver.assigned
    Event::assertDispatched(BookingLifecycleNotification::class, function ($event) use ($rental) {
        return $event->bookingType === 'rental'
            && $event->bookingId === $rental->id
            && $event->action === 'driver.assigned';
    });

    // Driver notification: rental.driver_assigned (G-41)
    Event::assertDispatched(BookingLifecycleNotification::class, function ($event) {
        return $event->bookingType === 'driver'
            && $event->bookingId === $this->driver1->id
            && $event->action === 'rental.driver_assigned';
    });
});

it('prevents assigning driver with overlapping resource commitment (G-41)', function () {
    $start = today()->addDays(5)->toDateString();
    $end = today()->addDays(7)->toDateString();

    // Occupy driver 1 and vehicle 1
    createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
        'start_date' => $start,
        'end_date' => $end,
        'status' => 'driver_assigned',
        'payment_status' => 'paid',
    ]);

    // Another rental on overlapping dates
    $newRental = createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'start_date' => $start,
        'end_date' => $end,
        'status' => 'pending',
        'payment_status' => 'pending',
    ]);

    // Attempting to assign driver1/vehicle1 must fail with 422
    $response = $this->actingAs($this->admin)
        ->postJson("/admin/car-rentals/{$newRental->id}/assign-driver", [
            'driver_id' => $this->driver1->id,
            'vehicle_id' => $this->vehicle1->id,
        ])
        ->assertStatus(422);

    expect($response->json('message'))->toMatch('/(already has an active|already committed)/');
});

it('restores previous driver online availability when reassigning rental driver (G-41)', function () {
    $rental = createTestRental([
        'customer_id' => $this->customer->id,
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver1->id,
        'vehicle_id' => $this->vehicle1->id,
        'start_date' => today()->addDays(5)->toDateString(),
        'end_date' => today()->addDays(7)->toDateString(),
        'status' => 'driver_assigned',
        'payment_status' => 'paid',
    ]);

    DriverAvailability::where('driver_id', $this->driver1->id)->update([
        'is_available' => false,
        'status' => 'offline',
    ]);

    // Reassign to driver 2
    $this->actingAs($this->admin)
        ->postJson("/admin/car-rentals/{$rental->id}/assign-driver", [
            'driver_id' => $this->driver2->id,
            'vehicle_id' => $this->vehicle2->id,
        ])
        ->assertOk();

    // Driver 1 availability is restored to online / available
    $d1Avail = DriverAvailability::where('driver_id', $this->driver1->id)->first();
    expect($d1Avail->is_available)->toBeTrue()
        ->and($d1Avail->status)->toBe('online');
});

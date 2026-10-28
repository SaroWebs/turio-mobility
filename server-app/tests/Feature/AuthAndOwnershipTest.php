<?php

use App\Models\BookingAuditLog;
use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\Otp;
use App\Models\RideBooking;
use App\Models\Tour;
use App\Models\TourDriverAssignment;
use App\Models\TourSchedule;
use App\Models\Vehicle;
use App\Services\StartVerificationService;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;

it('lets customers verify otp and access protected customer app routes', function () {
    $customer = Customer::create([
        'name' => 'OTP Customer',
        'phone' => '9500000001',
        'email' => 'otp-customer@example.com',
        'is_active' => true,
    ]);

    Otp::create([
        'phone' => $customer->phone,
        'type' => 'customer',
        'code' => '123456',
        'expires_at' => now()->addMinutes(5),
    ]);

    $this->getJson('/api/customer-app/me')->assertStatus(401);

    $response = $this->postJson('/api/customer-app/otp/verify', [
        'phone' => $customer->phone,
        'code' => '123456',
        'action' => 'login',
    ]);

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('customer.id', $customer->id)
        ->assertJsonStructure(['token']);

    $this->getJson('/api/customer-app/me', [
        'Authorization' => 'Bearer '.$response->json('token'),
    ])->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('customer.id', $customer->id);
});

it('sends customer otp for both existing and new phones with a development code', function () {
    Customer::create([
        'name' => 'Existing OTP Customer',
        'phone' => '9500000091',
        'email' => 'existing-otp@example.com',
        'is_active' => true,
    ]);

    $existing = $this->postJson('/api/customer-app/otp/send', [
        'phone' => '9500000091',
        'action' => 'login',
    ]);

    $existing->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('customer_exists', true)
        ->assertJsonStructure(['dev_otp']);

    $new = $this->postJson('/api/customer-app/otp/send', [
        'phone' => '9500000092',
        'action' => 'register',
    ]);

    $new->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('customer_exists', false)
        ->assertJsonStructure(['dev_otp']);
});

it('does not create or expose development otps in production when sms credentials are missing', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config([
        'app.env' => 'production',
        'services.otp.allow_dev_delivery' => false,
        'services.mtalkz.api_key' => 'your_mtalkz_api_key',
        'services.mtalkz.sender_id' => null,
        'services.mtalkz.entity_id' => null,
    ]);

    $response = $this->postJson('/api/customer-app/otp/send', [
        'phone' => '9500000199',
        'action' => 'login',
    ]);

    $response->assertStatus(503)
        ->assertJsonPath('success', false)
        ->assertJsonMissingPath('dev_otp');

    $this->assertDatabaseMissing('otps', [
        'phone' => '9500000199',
        'type' => 'customer',
    ]);
});

it('branches new customer otp verification into profile completion', function () {
    Otp::create([
        'phone' => '9500000093',
        'type' => 'customer',
        'code' => '333333',
        'expires_at' => now()->addMinutes(5),
    ]);

    $verify = $this->postJson('/api/customer-app/otp/verify', [
        'phone' => '9500000093',
        'code' => '333333',
        'action' => 'register',
    ]);

    $verify->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('requires_registration', true)
        ->assertJsonStructure(['registration_token']);

    $complete = $this->postJson('/api/customer-app/otp/register-complete', [
        'phone' => '9500000093',
        'registration_token' => $verify->json('registration_token'),
        'name' => 'New Modal Customer',
        'email' => 'new-modal@example.com',
    ]);

    $complete->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('requires_registration', false)
        ->assertJsonPath('customer.phone', '9500000093')
        ->assertJsonStructure(['token']);

    $customer = Customer::where('phone', '9500000093')->firstOrFail();
    expect($customer->wallet()->exists())->toBeTrue();
});

it('lets approved drivers verify otp and access protected driver app routes', function () {
    $driver = Driver::create([
        'name' => 'OTP Driver',
        'phone' => '8500000001',
        'email' => 'otp-driver@example.com',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);

    Otp::create([
        'phone' => $driver->phone,
        'type' => 'driver',
        'code' => '654321',
        'expires_at' => now()->addMinutes(5),
    ]);

    $this->getJson('/api/driver-app/me')->assertStatus(401);

    $response = $this->postJson('/api/driver-app/otp/verify', [
        'phone' => $driver->phone,
        'code' => '654321',
    ]);

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('driver.id', $driver->id)
        ->assertJsonStructure(['token']);

    $this->getJson('/api/driver-app/me', [
        'Authorization' => 'Bearer '.$response->json('token'),
    ])->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('driver.id', $driver->id);

    $this->getJson('/api/driver-app/wallet', [
        'Authorization' => 'Bearer '.$response->json('token'),
    ])->assertOk()
        ->assertJsonPath('data.balance', '0.00');
});

it('returns a development otp when an existing driver requests a login code', function () {
    $driver = Driver::create([
        'name' => 'Development OTP Driver',
        'phone' => '8500000099',
        'email' => 'development-otp-driver@example.com',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);

    $this->postJson('/api/driver-app/otp/send', [
        'phone' => $driver->phone,
    ])->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('driver_exists', true)
        ->assertJsonPath('dev_otp', '123456');
});

it('verifies an unknown driver before profile completion and enters the dashboard', function () {
    $phone = '8500000100';

    $this->postJson('/api/driver-app/otp/send', [
        'phone' => $phone,
    ])->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('driver_exists', false)
        ->assertJsonPath('next_step', 'verify_registration')
        ->assertJsonPath('dev_otp', '123456');

    $this->assertDatabaseMissing('drivers', ['phone' => $phone]);

    $verify = $this->postJson('/api/driver-app/otp/verify', [
        'phone' => $phone,
        'code' => '123456',
    ]);

    $verify->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('requires_profile', true)
        ->assertJsonStructure(['registration_token']);

    $complete = $this->postJson('/api/driver-app/otp/register-complete', [
        'registration_token' => $verify->json('registration_token'),
        'phone' => $phone,
        'name' => 'New Service Driver',
        'email' => 'new-service-driver@example.com',
        'license_number' => 'DL-TEST-100',
        'license_expiry' => now()->addYear()->toDateString(),
        'vehicle_type' => 'suv',
        'vehicle_number' => 'KA01TEST100',
        'vehicle_model' => 'Test SUV',
        'service_types' => ['ride', 'tour', 'rental'],
    ]);

    $complete->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('driver_created', true)
        ->assertJsonPath('driver_status', 'pending')
        ->assertJsonPath('requires_profile', false)
        ->assertJsonPath('driver.phone', $phone)
        ->assertJsonStructure(['token']);

    $this->assertDatabaseHas('drivers', [
        'phone' => $phone,
        'status' => 'pending',
        'is_active' => true,
        'is_approved' => false,
        'can_short_ride' => true,
        'can_long_ride' => true,
        'can_tour_transport' => true,
        'can_rental_delivery' => true,
    ]);

    $headers = ['Authorization' => 'Bearer '.$complete->json('token')];

    $this->getJson('/api/driver-app/me', $headers)
        ->assertOk()
        ->assertJsonPath('driver.phone', $phone);

    $this->getJson('/api/driver-app/dashboard', $headers)
        ->assertOk()
        ->assertJsonPath('driver.phone', $phone);

    $this->getJson('/api/driver-app/wallet', $headers)
        ->assertOk()
        ->assertJsonPath('data.balance', '0.00');

    $this->getJson('/api/driver-app/wallet/transactions', $headers)
        ->assertOk()
        ->assertJsonPath('data.data', []);

    $this->getJson('/api/driver-app/history', $headers)
        ->assertOk()
        ->assertJsonPath('data.data', []);

    $this->getJson('/api/driver-app/tour-assignments', $headers)
        ->assertOk()
        ->assertJsonPath('data.data', []);

    $this->getJson('/api/driver-app/rental-assignments', $headers)
        ->assertOk()
        ->assertJsonPath('data.data', []);

    $driver = Driver::where('phone', $phone)->firstOrFail();
    expect($driver->phone_verified_at)->not->toBeNull();
    expect($driver->is_approved)->toBeFalse();
});

it('blocks customers from accessing another customer ride booking', function () {
    $owner = Customer::create(['name' => 'Ride Owner', 'phone' => '9500000002']);
    $other = Customer::create(['name' => 'Other Customer', 'phone' => '9500000003']);

    $ride = RideBooking::create([
        'customer_id' => $owner->id,
        'service_type' => 'point_to_point',
        'customer_name' => $owner->name,
        'customer_phone' => $owner->phone,
        'pickup_location' => 'Point A',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'Point B',
        'dropoff_lat' => 12.9816,
        'dropoff_lng' => 77.6046,
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 10,
        'total_fare' => 250,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    Sanctum::actingAs($other);

    $this->getJson("/api/customer-app/rides/{$ride->id}")->assertForbidden();
    $this->getJson("/api/customer-app/tracking/ride/{$ride->id}")->assertForbidden();
    $this->postJson("/api/customer-app/rides/{$ride->id}/cancel", [
        'reason' => 'Wrong customer',
    ])->assertForbidden();
});

it('removes a customer point ride cancelled before pickup', function () {
    $customer = Customer::create(['name' => 'Cancel Customer', 'phone' => '9500000005']);

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Point A',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'Point B',
        'dropoff_lat' => 12.9816,
        'dropoff_lng' => 77.6046,
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 10,
        'total_fare' => 250,
        'status' => 'pending',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    Sanctum::actingAs($customer);

    $this->postJson("/api/customer-app/rides/{$ride->id}/cancel", [
        'reason' => 'Plans changed',
    ])->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.id', $ride->id)
        ->assertJsonPath('data.removed', true)
        ->assertJsonPath('data.refund_amount', 0);

    $this->assertDatabaseMissing('ride_bookings', ['id' => $ride->id]);
    $this->getJson('/api/customer-app/rides')
        ->assertOk()
        ->assertJsonPath('data.data', []);
});

it('preserves a cancelled point ride and releases its en route driver', function () {
    $customer = Customer::create(['name' => 'En Route Customer', 'phone' => '9500000007']);
    $driver = Driver::create([
        'name' => 'En Route Driver',
        'phone' => '8500000007',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);
    DriverAvailability::create([
        'driver_id' => $driver->id,
        'is_available' => false,
        'status' => 'on_ride',
    ]);
    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Point A',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'Point B',
        'dropoff_lat' => 12.9816,
        'dropoff_lng' => 77.6046,
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 10,
        'total_fare' => 250,
        'status' => 'driver_arriving',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    Sanctum::actingAs($customer);

    $this->postJson("/api/customer-app/rides/{$ride->id}/cancel")
        ->assertOk()
        ->assertJsonPath('data.booking.status', 'cancelled');

    $this->assertDatabaseHas('ride_bookings', ['id' => $ride->id, 'status' => 'cancelled']);
    $this->assertDatabaseHas('driver_availabilities', [
        'driver_id' => $driver->id,
        'is_available' => true,
        'status' => 'online',
    ]);
});

it('lets customers create a support incident for their own ride booking', function () {
    $customer = Customer::create(['name' => 'Support Customer', 'phone' => '9500000006']);

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Point A',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'Point B',
        'dropoff_lat' => 12.9816,
        'dropoff_lng' => 77.6046,
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 10,
        'total_fare' => 250,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    Sanctum::actingAs($customer);

    $this->postJson('/api/customer-app/support/requests', [
        'service_type' => 'ride',
        'booking_id' => $ride->id,
        'topic' => 'Payment or wallet',
        'details' => 'Payment status needs review.',
        'severity' => 'medium',
    ])->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.type', 'payment')
        ->assertJsonPath('data.customer_id', $customer->id)
        ->assertJsonPath('data.incidentable_id', $ride->id);
});

it('returns customer next steps and records customer check-in for rental bookings', function () {
    $customer = Customer::create(['name' => 'Checkin Customer', 'phone' => '9500000016']);
    $category = CarCategory::create([
        'name' => 'Checkin SUV',
        'slug' => 'checkin-suv',
        'vehicle_type' => 'suv',
        'seats' => 6,
        'base_price_per_day' => 2500,
    ]);

    $rental = CarRental::create([
        'customer_id' => $customer->id,
        'car_category_id' => $category->id,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'start_date' => now()->addDays(2)->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
        'number_of_days' => 2,
        'pickup_location' => 'Airport gate',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'Hotel lobby',
        'base_price' => 5000,
        'total_price' => 5000,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    Sanctum::actingAs($customer);

    $this->getJson("/api/customer-app/car-rentals/{$rental->id}/next-steps")
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.service_type', 'rental')
        ->assertJsonPath('data.actions.can_check_in', true)
        ->assertJsonStructure(['data' => ['start_verification' => ['code'], 'instructions']]);

    $this->postJson("/api/customer-app/car-rentals/{$rental->id}/check-in", [
        'latitude' => 12.9717,
        'longitude' => 77.5947,
        'note' => 'At the gate.',
    ])->assertOk()
        ->assertJsonPath('success', true);

    $this->assertDatabaseHas('booking_audit_logs', [
        'auditable_type' => CarRental::class,
        'auditable_id' => $rental->id,
        'action' => 'customer.checkin.completed',
    ]);
});

it('lets assigned drivers start rentals only with the customer start otp', function () {
    $customer = Customer::create(['name' => 'Rental OTP Customer', 'phone' => '9500000017']);
    $driver = Driver::create([
        'name' => 'Rental OTP Driver',
        'phone' => '8500000017',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_rental_delivery' => true,
    ]);
    DriverAvailability::create([
        'driver_id' => $driver->id,
        'is_available' => false,
        'status' => 'on_ride',
    ]);
    $category = CarCategory::create([
        'name' => 'OTP Hatchback',
        'slug' => 'otp-hatchback',
        'vehicle_type' => 'hatchback',
        'seats' => 4,
        'base_price_per_day' => 1800,
    ]);
    $vehicle = Vehicle::create([
        'car_category_id' => $category->id,
        'driver_id' => $driver->id,
        'registration_number' => 'KA01OTP17',
        'make' => 'Toyota',
        'model' => 'Etios',
        'year' => 2024,
        'color' => 'White',
        'fuel_type' => 'petrol',
        'seats' => 4,
        'is_active' => true,
        'approval_status' => 'approved',
        'condition' => 'good',
    ]);
    $rental = CarRental::create([
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'vehicle_id' => $vehicle->id,
        'car_category_id' => $category->id,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'start_date' => now()->addDay()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'number_of_days' => 2,
        'pickup_location' => 'Terminal',
        'base_price' => 3600,
        'total_price' => 3600,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    Sanctum::actingAs($driver);

    $this->postJson("/api/driver-app/tracking/rental/{$rental->id}/status", [
        'status' => 'in_progress',
        'start_pin' => '0000',
    ])->assertStatus(422);

    $pin = app(StartVerificationService::class)->codeFor($rental, 'rental');

    $this->postJson("/api/driver-app/tracking/rental/{$rental->id}/status", [
        'status' => 'in_progress',
        'start_pin' => $pin,
    ])->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'in_progress');

    expect($rental->fresh()->status)->toBe('in_progress')
        ->and(BookingAuditLog::where('auditable_type', CarRental::class)
            ->where('auditable_id', $rental->id)
            ->where('action', 'operator.start_pin.verified')
            ->exists())->toBeTrue();
});

it('blocks drivers from accessing another driver assignment', function () {
    $customer = Customer::create(['name' => 'Assignment Customer', 'phone' => '9500000004']);
    $assignedDriver = Driver::create([
        'name' => 'Assigned Driver',
        'phone' => '8500000002',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_tour_transport' => true,
        'can_rental_delivery' => true,
    ]);
    $otherDriver = Driver::create([
        'name' => 'Other Driver',
        'phone' => '8500000003',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_tour_transport' => true,
        'can_rental_delivery' => true,
    ]);

    $tour = Tour::create([
        'title' => 'Ownership Tour',
        'slug' => 'ownership-tour',
        'duration_days' => 1,
        'duration_nights' => 0,
        'price_per_person' => 1000,
        'child_price' => 500,
        'available_from' => now(),
        'available_to' => now()->addMonth(),
        'is_active' => true,
    ]);

    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addWeek()->toDateString(),
        'return_date' => now()->addWeek()->toDateString(),
        'total_seats' => 10,
        'booked_seats' => 0,
        'reserved_seats' => 0,
        'status' => 'open',
    ]);

    $assignment = TourDriverAssignment::create([
        'tour_schedule_id' => $schedule->id,
        'driver_id' => $assignedDriver->id,
        'role' => 'transport',
        'status' => 'assigned',
    ]);

    $category = CarCategory::create([
        'name' => 'Ownership Sedan',
        'slug' => 'ownership-sedan',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 1500,
    ]);

    $rental = CarRental::create([
        'customer_id' => $customer->id,
        'driver_id' => $assignedDriver->id,
        'car_category_id' => $category->id,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'start_date' => now()->addDays(2)->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
        'number_of_days' => 2,
        'pickup_location' => 'Airport',
        'base_price' => 3000,
        'total_price' => 3000,
        'status' => 'driver_assigned',
        'payment_status' => 'pending',
    ]);

    Sanctum::actingAs($otherDriver);

    $this->postJson("/api/driver-app/tour-assignments/{$assignment->id}/accept")->assertNotFound();
    $this->postJson("/api/driver-app/rentals/{$rental->id}/complete")->assertForbidden();
});

it('always returns gone for deprecated guide app apis', function () {
    $paths = [
        ['GET', '/api/guide-app/me'],
        ['POST', '/api/guide-app/otp/send'],
        ['POST', '/api/guide-app/assignments/1/accept'],
        ['DELETE', '/api/guide-app/logout'],
    ];

    foreach ($paths as [$method, $path]) {
        $this->json($method, $path, ['phone' => '7500000001'])
            ->assertStatus(410)
            ->assertJsonPath('success', false);
    }
});

it('does not expose active guide controllers in the route list', function () {
    $guideControllerRoutes = collect(Route::getRoutes())
        ->map(fn ($route) => $route->getActionName())
        ->filter(fn ($action) => str_contains($action, 'Guide') && $action !== 'Closure')
        ->values()
        ->all();

    expect($guideControllerRoutes)->toBe([]);
});

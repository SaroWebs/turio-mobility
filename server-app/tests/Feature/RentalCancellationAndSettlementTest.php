<?php

use App\Events\BookingLifecycleNotification;
use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\BookingCancellationService;
use App\Services\RentalSettlementService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Event::fake([BookingLifecycleNotification::class]);

    $this->admin = User::factory()->create([
        'name' => 'Admin Settler',
        'email' => 'admin.settle@example.com',
    ]);
    Role::firstOrCreate(['name' => 'admin', 'display_name' => 'Admin']);
    $this->admin->assignRole('admin');

    $this->customer = Customer::create([
        'name' => 'Bob Renter',
        'email' => 'bob@example.com',
        'phone' => '9900223344',
        'is_active' => true,
    ]);

    $this->category = CarCategory::create([
        'name' => 'Premium SUV',
        'slug' => 'premium-suv',
        'vehicle_type' => 'suv',
        'seats' => 6,
        'base_price_per_day' => 3000,
        'included_km_per_day' => 150,
        'extra_km_charge' => 15,
        'included_hours_per_day' => 10,
        'extra_hour_charge' => 200,
        'is_active' => true,
    ]);

    $this->driver = Driver::create([
        'name' => 'Dave Driver',
        'phone' => '9888222001',
        'email' => 'dave@example.com',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'can_rental_delivery' => true,
        'rating' => 4.8,
    ]);

    DriverAvailability::create([
        'driver_id' => $this->driver->id,
        'is_available' => true,
        'status' => 'online',
        'last_updated' => now(),
    ]);

    $this->vehicle = Vehicle::create([
        'car_category_id' => $this->category->id,
        'driver_id' => $this->driver->id,
        'registration_number' => 'KA05SUV01',
        'make' => 'Toyota',
        'model' => 'Fortuner',
        'year' => 2024,
        'color' => 'Black',
        'fuel_type' => 'diesel',
        'seats' => 6,
        'is_ac' => true,
        'is_active' => true,
        'approval_status' => 'approved',
        'condition' => 'good',
        'is_available_for_rent' => true,
    ]);
});

function makeRental(array $attrs = []): CarRental
{
    $start = $attrs['start_date'] ?? today()->addDays(5)->toDateString();
    $end = $attrs['end_date'] ?? today()->addDays(7)->toDateString();
    $days = Carbon::parse($start)->diffInDays(Carbon::parse($end)) + 1;

    return CarRental::create(array_merge([
        'customer_name' => 'Bob Renter',
        'customer_email' => 'bob@example.com',
        'customer_phone' => '9900223344',
        'customer_id' => test()->customer->id,
        'car_category_id' => test()->category->id,
        'driver_id' => test()->driver->id,
        'vehicle_id' => test()->vehicle->id,
        'start_date' => $start,
        'end_date' => $end,
        'start_time' => '09:00',
        'end_time' => '18:00',
        'number_of_days' => $days,
        'pickup_location' => 'Bangalore Airport',
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'payment_method' => 'razorpay',
        'base_price' => 3000 * $days,
        'total_price' => 3000 * $days,
    ], $attrs));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// G-42 — Cancellation Policy, Fee Preview, Refund & Notifications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test('cancel preview returns correct fee tier — free (>48h)', function () {
    // Start is 5 days from now → well over 48 h
    $rental = makeRental();

    Sanctum::actingAs($this->customer, ['*'], 'customer');

    $response = $this->getJson("/api/customer-app/car-rentals/{$rental->id}/cancel-preview");

    $response->assertOk();
    $data = $response->json('data');
    expect($data['tier'])->toBe('free');
    expect($data['cancellation_fee'])->toEqual(0);
    expect($data['refund_amount'])->toEqual($data['total']);
});

test('cancel preview returns medium tier fee (24-48h before start)', function () {
    // Start 30 hours from now → between 24 and 48
    $rental = makeRental([
        'start_date' => now()->addHours(30)->toDateString(),
    ]);

    // Freeze time at exactly 30h before the start date's beginning
    Carbon::setTestNow(Carbon::parse($rental->start_date)->subHours(30));

    Sanctum::actingAs($this->customer, ['*'], 'customer');

    $response = $this->getJson("/api/customer-app/car-rentals/{$rental->id}/cancel-preview");

    $response->assertOk();
    $data = $response->json('data');
    expect($data['tier'])->toBe('medium');
    expect($data['cancellation_fee'])->toEqual(round((float) $rental->total_price * 0.25, 2));

    Carbon::setTestNow();
});

test('cancel preview returns late tier fee (<24h before start)', function () {
    // Start 12 hours from now
    $start = now()->addHours(12);
    $rental = makeRental([
        'start_date' => $start->toDateString(),
    ]);

    // Freeze time at 12h before start date (start of day)
    Carbon::setTestNow(Carbon::parse($rental->start_date)->subHours(12));

    Sanctum::actingAs($this->customer, ['*'], 'customer');

    $response = $this->getJson("/api/customer-app/car-rentals/{$rental->id}/cancel-preview");

    $response->assertOk();
    $data = $response->json('data');
    expect($data['tier'])->toBe('late');
    expect($data['cancellation_fee'])->toEqual(round((float) $rental->total_price * 0.50, 2));

    Carbon::setTestNow();
});

test('rental cancellation applies multi-tier fee and tracks actor', function () {
    // Start 30 hours from now → medium tier (25%)
    $rental = makeRental([
        'start_date' => now()->addHours(30)->toDateString(),
    ]);

    Carbon::setTestNow(Carbon::parse($rental->start_date)->subHours(30));

    Sanctum::actingAs($this->customer, ['*'], 'customer');

    $response = $this->postJson("/api/customer-app/car-rentals/{$rental->id}/cancel", [
        'reason' => 'Plans changed.',
    ]);

    $response->assertOk();
    $response->assertJsonPath('data.booking.status', 'cancelled');

    $rental->refresh();
    expect($rental->status)->toBe('cancelled');
    expect($rental->cancelled_by_type)->toBe('customer');
    expect((float) $rental->cancellation_fee)->toBe(round((float) $rental->total_price * 0.25, 2));
    expect($rental->cancelled_at)->not->toBeNull();

    Carbon::setTestNow();
});

test('admin cancellation applies no fee', function () {
    $rental = makeRental();

    $this->actingAs($this->admin);

    $response = $this->postJson("/admin/car-rentals/{$rental->id}/update-status", [
        'status' => 'cancelled',
        'cancellation_reason' => 'Vehicle recalled for maintenance.',
    ]);

    $response->assertOk();
    $rental->refresh();
    expect($rental->status)->toBe('cancelled');
    expect((float) $rental->cancellation_fee)->toBe(0.0);
    expect((float) $rental->refund_amount)->toBe((float) $rental->total_price);
});

test('rental cancellation emits driver release notification', function () {
    $rental = makeRental();

    Sanctum::actingAs($this->customer, ['*'], 'customer');
    $this->postJson("/api/customer-app/car-rentals/{$rental->id}/cancel", ['reason' => 'No longer needed.']);

    Event::assertDispatched(BookingLifecycleNotification::class, function ($e) {
        return $e->event === 'rental.driver_released';
    });
});

test('completed or cancelled bookings reject cancellation', function () {
    $rental = makeRental(['status' => 'completed']);

    Sanctum::actingAs($this->customer, ['*'], 'customer');

    $response = $this->postJson("/api/customer-app/car-rentals/{$rental->id}/cancel", ['reason' => 'Try again.']);
    $response->assertStatus(422);
});

test('unpaid rental cancellation results in zero fee and no refund', function () {
    $rental = makeRental(['payment_status' => 'pending', 'payment_method' => 'cash']);

    Sanctum::actingAs($this->customer, ['*'], 'customer');

    $response = $this->postJson("/api/customer-app/car-rentals/{$rental->id}/cancel", ['reason' => 'Changed mind.']);

    $response->assertOk();
    $rental->refresh();
    expect($rental->status)->toBe('cancelled');
    expect((float) $rental->cancellation_fee)->toBe(0.0);
    expect((float) $rental->refund_amount)->toBe(0.0);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// G-43 — Extra Charges: Km Overage, Overtime, Surcharges
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test('settlement preview computes km overage correctly', function () {
    $rental = makeRental(['status' => 'completed']);
    // 3 days × 150 km/day = 450 km included. Actual 600 → 150 extra × ₹15/km = ₹2250
    $service = app(RentalSettlementService::class);
    $result = $service->preview($rental, ['actual_km' => 600]);

    expect($result['km_overage_charge'])->toBe(2250.0);
    expect($result['breakdown']['included_km'])->toBe(450);
    expect($result['breakdown']['extra_km'])->toBe(150.0);
});

test('settlement preview computes overtime correctly', function () {
    $rental = makeRental([
        'status' => 'completed',
        'end_date' => today()->addDays(7)->toDateString(),
        'end_time' => '18:00',
    ]);

    // Return 3 hours late → 3h - 0.5h grace = 2.5h overtime × ₹200/h = ₹500
    $scheduledReturn = Carbon::parse($rental->end_date->toDateString().' 18:00');
    $lateReturn = $scheduledReturn->copy()->addHours(3)->toDateTimeString();

    $service = app(RentalSettlementService::class);
    $result = $service->preview($rental, [
        'actual_return_at' => $lateReturn,
    ]);

    expect($result['extra_hours_charge'])->toBe(500.0);
    expect($result['breakdown']['overtime_hours'])->toBe(2.5);
});

test('settlement preview handles surcharge items', function () {
    $rental = makeRental(['status' => 'completed']);

    $service = app(RentalSettlementService::class);
    $result = $service->preview($rental, [
        'surcharge_items' => [
            ['name' => 'Toll – National Highway 44', 'amount' => 350],
            ['name' => 'Airport parking', 'amount' => 150],
        ],
    ]);

    expect($result['surcharges'])->toBe(500.0);
    expect($result['settlement_total'])->toBe(500.0);
});

test('admin can settle a completed rental via HTTP', function () {
    $rental = makeRental(['status' => 'completed']);

    $this->actingAs($this->admin);

    $scheduledReturn = Carbon::parse($rental->end_date->toDateString().' 18:00');
    $lateReturn = $scheduledReturn->copy()->addHours(2)->toDateTimeString();

    $response = $this->postJson("/admin/car-rentals/{$rental->id}/settle", [
        'actual_km' => 500,
        'actual_return_at' => $lateReturn,
        'surcharge_items' => [
            ['name' => 'Toll charges', 'amount' => 200],
        ],
        'notes' => 'All in order, minor delay.',
    ]);

    $response->assertOk();
    $settled = $response->json('car_rental');

    $rental->refresh();
    expect($rental->settled_at)->not->toBeNull();
    expect((float) $rental->actual_km)->toBe(500.0);
    expect((float) $rental->surcharges)->toBe(200.0);
    // 3 days × 150 = 450 included km. 500-450=50 extra × ₹15 = ₹750
    expect((float) $rental->km_overage_charge)->toBe(750.0);
    // 2h late - 0.5h grace = 1.5h × ₹200 = ₹300
    expect((float) $rental->extra_hours_charge)->toBe(300.0);
    // Total: 750 + 300 + 200 = 1250
    expect((float) $rental->settlement_total)->toBe(1250.0);

    // Audit log recorded
    expect($rental->auditLogs()->where('action', 'rental.settled')->exists())->toBeTrue();
});

test('settlement preview via admin HTTP endpoint', function () {
    $rental = makeRental(['status' => 'completed']);

    $this->actingAs($this->admin);

    $response = $this->postJson("/admin/car-rentals/{$rental->id}/settlement-preview", [
        'actual_km' => 300,
    ]);

    $response->assertOk();
    $data = $response->json('data');
    // 300 km within 450 included → no overage
    expect($data['km_overage_charge'])->toBe(0.0);
});

test('settlement rejects non-completed rental', function () {
    $rental = makeRental(['status' => 'confirmed']);

    $this->actingAs($this->admin);

    $response = $this->postJson("/admin/car-rentals/{$rental->id}/settle", [
        'actual_km' => 100,
    ]);

    $response->assertStatus(422);
});

test('settlement rejects double settlement', function () {
    $rental = makeRental(['status' => 'completed']);

    $service = app(RentalSettlementService::class);
    $service->settle($rental, ['actual_km' => 100]);

    $this->actingAs($this->admin);
    $response = $this->postJson("/admin/car-rentals/{$rental->id}/settle", ['actual_km' => 200]);

    $response->assertStatus(422);
});

test('no overtime within grace period', function () {
    $rental = makeRental([
        'status' => 'completed',
        'end_time' => '18:00',
    ]);

    $scheduledReturn = Carbon::parse($rental->end_date->toDateString().' 18:00');
    // 20 min late — within 30 min grace
    $lateReturn = $scheduledReturn->copy()->addMinutes(20)->toDateTimeString();

    $service = app(RentalSettlementService::class);
    $result = $service->preview($rental, ['actual_return_at' => $lateReturn]);

    expect($result['extra_hours_charge'])->toBe(0.0);
    expect($result['breakdown']['overtime_hours'])->toBe(0.0);
});

test('settlement lifecycle notification dispatched', function () {
    $rental = makeRental(['status' => 'completed']);

    $service = app(RentalSettlementService::class);
    $service->settle($rental, ['actual_km' => 500]);

    Event::assertDispatched(BookingLifecycleNotification::class, function ($e) {
        return $e->event === 'rental.settled';
    });
});

<?php

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourDriverAssignment;
use App\Models\TourSchedule;
use App\Models\Vehicle;
use App\Models\Wallet;
use App\Services\TourSettlementService;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->withHeaders(['Idempotency-Key' => 'cash-collection-test']);
    Event::fake([\App\Events\BookingLifecycleNotification::class]);
    $this->customer = Customer::create(['name' => 'Test Cust', 'phone' => '919000000000']);
    $this->driver = Driver::create(['name' => 'Test Driver', 'phone' => '919000000001', 'is_approved' => true, 'status' => 'active']);
    $this->category = CarCategory::create(['name' => 'SUV', 'slug' => 'suv', 'vehicle_type' => 'suv', 'seats' => 4]);
    $this->vehicle = Vehicle::create(['driver_id' => $this->driver->id, 'car_category_id' => $this->category->id, 'registration_number' => 'AB12CD3456', 'make' => 'Toyota', 'model' => 'Innova', 'year' => 2020, 'color' => 'White', 'fuel_type' => 'diesel', 'seats' => 4, 'is_ac' => true, 'is_active' => true, 'approval_status' => 'approved']);

    $this->tour = Tour::create(['title' => 'Test tour', 'slug' => 'test-tour', 'price_per_person' => 1000, 'duration_days' => 1, 'is_active' => true]);
    $this->schedule = TourSchedule::create([
        'tour_id' => $this->tour->id,
        'departure_date' => now()->toDateString(),
        'return_date' => now()->addDay()->toDateString(),
        'status' => 'open',
        'total_seats' => 10,
    ]);

    $this->assignment = TourDriverAssignment::create([
        'tour_schedule_id' => $this->schedule->id,
        'driver_id' => $this->driver->id,
        'vehicle_id' => $this->vehicle->id,
        'role' => 'transport',
        'status' => 'accepted',
    ]);
    \App\Models\Setting::updateOrCreate(['key' => 'tour.settlement.margin_rate'], ['value' => '0.2']); // 20% margin
});

function createTestBooking($test, $onlinePaidMinor, $totalMinor, $paymentStatus = 'partial', $paymentPlan = true)
{
    $booking = TourBooking::create([
        'booking_number' => \Illuminate\Support\Str::random(10),
        'customer_id' => $test->customer->id,
        'customer_name' => $test->customer->name,
        'customer_phone' => $test->customer->phone,
        'customer_email' => 'test@example.com',
        'tour_id' => $test->tour->id,
        'tour_schedule_id' => $test->schedule->id,
        'travel_date' => now()->toDateString(),
        'number_of_adults' => 1,
        'number_of_children' => 0,
        'total_price' => $totalMinor / 100,
        'status' => 'pending',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
        'assigned_driver_id' => $test->driver->id,
        'online_paid_minor' => 0,
        'payment_plan' => $paymentPlan ? [
            'total_minor' => $totalMinor,
            'minimum_minor' => 20000,
            'selected_minor' => $onlinePaidMinor,
            'policy_version' => 'v1', 'margin_policy' => ['basis_points' => 2000, 'version' => 'test'],
        ] : null,
    ]);
    if ($onlinePaidMinor > 0) {
        $order = app(\App\Services\PaymentService::class)->createOrder($onlinePaidMinor, $booking, $test->customer);
        app(\App\Services\PaymentService::class)->recordCapturedPayment(['order' => $order, 'payable' => $booking, 'owner' => $test->customer, 'provider_payment_id' => 'pay_'.$booking->id, 'amount_minor' => $onlinePaidMinor]);
    }
    $booking->refresh()->update(['status' => 'completed']);

    return $booking->refresh();
}

it('settles a fully online paid tour booking correctly', function () {
    $booking = createTestBooking($this, 100000, 100000, 'paid');

    $service = app(TourSettlementService::class);
    $result = $service->settle($booking);

    expect($result)->toBeTrue();

    $booking->refresh();
    expect($booking->settled_at)->not->toBeNull();
    expect($booking->margin_minor)->toBe(20000); // 20% of 100000
    expect($booking->driver_entitlement_minor)->toBe(80000);
    expect($booking->cash_collected_minor)->toBe(0);
    expect($booking->net_settlement_minor)->toBe(80000);
    expect((float) $booking->commission_amount)->toBe(200.0);
    expect((float) $booking->driver_share)->toBe(800.0);

    $wallet = Wallet::where('owner_type', Driver::class)->where('owner_id', $this->driver->id)->first();
    expect($wallet)->not->toBeNull();
    expect($wallet->balance_minor)->toBe(80000);
});

it('settles a partial deposit plus cash correctly', function () {
    $booking = createTestBooking($this, 20000, 100000, 'partial');

    // Driver collects 80000 cash
    Sanctum::actingAs($this->driver);
    $this->postJson("/api/driver-app/tour-bookings/{$booking->id}/collect-cash", [
        'amount_minor' => 80000,
        'evidence' => 'Collected in person',
    ])->assertOk();

    $service = app(TourSettlementService::class);
    $result = $service->settle($booking);

    $booking->refresh();
    expect($booking->settled_at)->not->toBeNull();
    expect($booking->margin_minor)->toBe(20000);
    expect($booking->driver_entitlement_minor)->toBe(80000);
    expect($booking->cash_collected_minor)->toBe(80000);
    expect($booking->net_settlement_minor)->toBe(0); // Gets 80k entitlement, collected 80k cash -> net 0

    $wallet = Wallet::where('owner_type', Driver::class)->where('owner_id', $this->driver->id)->first();
    expect($wallet->balance_minor ?? 0)->toBe(0);
});

it('returns remaining cash properly for the driver endpoint', function () {
    $booking = createTestBooking($this, 30000, 100000, 'partial');

    Sanctum::actingAs($this->driver);
    $this->getJson("/api/driver-app/tour-assignments/{$this->assignment->id}/cash-summary")
        ->assertOk()
        ->assertJsonPath('data.total_remaining_cash_minor', 70000)
        ->assertJsonPath('data.bookings.0.remaining_cash_minor', 70000)
        ->assertJsonPath('data.bookings.0.cash_collected_minor', 0);

    // Collect partial cash
    $this->postJson("/api/driver-app/tour-bookings/{$booking->id}/collect-cash", [
        'amount_minor' => 40000,
        'evidence' => 'Partial collect',
    ])->assertOk();

    $this->getJson("/api/driver-app/tour-assignments/{$this->assignment->id}/cash-summary")
        ->assertOk()
        ->assertJsonPath('data.total_remaining_cash_minor', 30000)
        ->assertJsonPath('data.bookings.0.remaining_cash_minor', 30000)
        ->assertJsonPath('data.bookings.0.cash_collected_minor', 40000);
});

it('prevents collecting more cash than remaining', function () {
    $booking = createTestBooking($this, 20000, 100000, 'partial');

    Sanctum::actingAs($this->driver);
    $this->postJson("/api/driver-app/tour-bookings/{$booking->id}/collect-cash", [
        'amount_minor' => 80001,
        'evidence' => 'Oops',
    ])->assertStatus(422);
});

it('is idempotent on settlement', function () {
    $booking = createTestBooking($this, 100000, 100000, 'paid');

    $service = app(TourSettlementService::class);
    $result1 = $service->settle($booking);

    $wallet = Wallet::where('owner_type', Driver::class)->where('owner_id', $this->driver->id)->first();
    expect($wallet->balance_minor)->toBe(80000);

    $result2 = $service->settle($booking); // Second call
    expect($result2)->toBeTrue();

    $wallet->refresh();
    expect($wallet->balance_minor)->toBe(80000); // Still 80k
});

it('does not settle an outstanding cash balance', function () {
    $booking = createTestBooking($this, 20000, 100000);
    expect(app(TourSettlementService::class)->settle($booking))->toBeFalse();
    expect($booking->fresh()->settled_at)->toBeNull();
    expect(Wallet::count())->toBe(0);
});

it('requires an immutable margin policy and completion', function () {
    $booking = createTestBooking($this, 100000, 100000, 'paid');
    $booking->update(['status' => 'confirmed']);
    expect(app(TourSettlementService::class)->settle($booking))->toBeFalse();
    $booking->update(['status' => 'completed']);
    $plan = $booking->payment_plan;
    $plan['margin_policy'] = null;
    // Simulate a pre-policy legacy deposit row, not an allowed application amendment.
    \Illuminate\Support\Facades\DB::table('tour_bookings')->where('id', $booking->id)->update(['payment_plan' => json_encode($plan)]);
    expect(app(TourSettlementService::class)->settle($booking->fresh()))->toBeFalse();
});

it('reverses a credited settlement once before refunding', function () {
    $booking = createTestBooking($this, 100000, 100000, 'paid');
    $service = app(TourSettlementService::class);
    $service->settle($booking);
    $refund = $booking->refunds()->create(['customer_id' => $booking->customer_id, 'amount' => 1000, 'status' => 'pending', 'reason' => 'Service refund']);
    app(\App\Services\BookingCancellationService::class)->processRefund($refund);
    app(\App\Services\BookingCancellationService::class)->processRefund($refund->fresh());
    expect(Wallet::where('owner_type', Driver::class)->first()->getBalanceMinor())->toBe(0);
    expect($booking->auditLogs()->where('action', 'tour.settlement_reversed')->count())->toBe(1);
});

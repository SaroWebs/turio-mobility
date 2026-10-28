<?php

use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\RideBooking;
use App\Services\BookingCancellationService;
use App\Services\RideRequestLifecycle;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Event::fake([\App\Events\RideStatusUpdated::class, \App\Events\BookingLifecycleNotification::class]);
    $this->customer = Customer::create(['name' => 'Cancellation customer', 'phone' => '9000012356', 'is_active' => true]);
    $this->driver = Driver::create(['name' => 'Cancellation driver', 'phone' => '8000012356', 'status' => 'active', 'is_active' => true, 'is_approved' => true]);
    $this->availability = DriverAvailability::create(['driver_id' => $this->driver->id, 'status' => 'on_ride', 'is_available' => false, 'last_updated' => now()]);
    $this->ride = RideBooking::create(['customer_id' => $this->customer->id, 'customer_name' => 'Customer', 'customer_phone' => '9000012356', 'driver_id' => $this->driver->id, 'service_type' => 'point_to_point', 'pickup_location' => 'A', 'dropoff_location' => 'B', 'scheduled_at' => now(), 'status' => 'pickup', 'payment_method' => 'cash', 'payment_status' => 'pending', 'total_fare' => 100, 'driver_assigned_at' => now()]);
});

function gapSearchPayload(): array
{
    return ['service_type' => 'point_to_point', 'request_mode' => 'immediate',
        'pickup_location' => 'Airport', 'pickup_lat' => 26.8242, 'pickup_lng' => 75.8122,
        'dropoff_location' => 'Fort', 'dropoff_lat' => 26.9855, 'dropoff_lng' => 75.8513,
        'scheduled_at' => now()->addMinute()->toISOString(), 'payment_method' => 'cash'];
}

it('recovers only the authenticated customers current ride', function () {
    Sanctum::actingAs($this->customer);
    $this->getJson('/api/customer-app/rides/current')->assertOk()->assertJsonPath('data.id', $this->ride->id)->assertJsonStructure(['server_time']);
    $other = Customer::create(['name' => 'Other customer', 'phone' => '9000012399']);
    Sanctum::actingAs($other);
    $this->getJson('/api/customer-app/rides/current')->assertOk()->assertJsonPath('data', null);
});

it('recovers a live search but not an expired or future scheduled unassigned request', function () {
    $this->freezeTime();
    Sanctum::actingAs($this->customer);
    $this->ride->update(['status' => 'pending', 'driver_id' => null, 'request_expires_at' => now()->addSecond()]);
    $this->getJson('/api/customer-app/rides/current')->assertOk()->assertJsonPath('data.id', $this->ride->id);
    $this->travel(1)->seconds();
    $this->getJson('/api/customer-app/rides/current')->assertOk()->assertJsonPath('data', null);
    $this->ride->update(['request_expires_at' => null, 'scheduled_at' => now()->addDay()]);
    $this->getJson('/api/customer-app/rides/current')->assertOk()->assertJsonPath('data', null);
});

it('does not let a driver identity read a customer ride with the same numeric id', function () {
    Sanctum::actingAs($this->driver);
    $this->getJson('/api/customer-app/rides/current')->assertForbidden();
});

it('blocks admin assignment of expired or closed immediate searches', function (string $status) {
    $admin = \App\Models\User::create(['name' => 'Admin', 'email' => 'search-admin@example.com', 'password' => 'password']);
    $role = \App\Models\Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);
    $this->ride->update(['status' => $status, 'driver_id' => null, 'request_expires_at' => now()]);
    $this->actingAs($admin)->postJson('/admin/ride-bookings/'.$this->ride->id.'/assign-driver', ['driver_id' => $this->driver->id])->assertStatus(409);
    expect($this->ride->fresh()->driver_id)->toBeNull();
})->with(['pending', 'cancelled', 'completed']);

it('blocks admin acceptance of a second immediate ride for the same customer', function () {
    $admin = \App\Models\User::create(['name' => 'Admin', 'email' => 'second-search-admin@example.com', 'password' => 'password']);
    $role = \App\Models\Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);
    $new = $this->ride->replicate(['booking_number']);
    $new->fill(['driver_id' => null, 'status' => 'pending', 'request_expires_at' => now()->addMinutes(10)])->save();
    $this->actingAs($admin)->postJson('/admin/ride-bookings/'.$new->id.'/assign-driver', ['driver_id' => $this->driver->id])->assertStatus(409);
    expect($new->fresh()->driver_id)->toBeNull();
});

it('blocks new customer searches while a ride is active and returns its identifier', function (string $status) {
    $this->ride->update(['status' => $status]);
    Sanctum::actingAs($this->customer);
    $this->postJson('/api/customer-app/rides', gapSearchPayload())->assertStatus(409)
        ->assertJsonPath('active_ride_id', $this->ride->id);
    expect(RideBooking::where('customer_id', $this->customer->id)->count())->toBe(1);
})->with(['driver_assigned', 'driver_arriving', 'pickup', 'in_transit']);

it('supersedes an abandoned search and gives the replacement exactly ten minutes', function () {
    $this->freezeTime();
    $this->ride->update(['status' => 'pending', 'driver_id' => null, 'request_expires_at' => now()->addMinute()]);
    Sanctum::actingAs($this->customer);
    $response = $this->postJson('/api/customer-app/rides', gapSearchPayload())->assertCreated();
    $new = RideBooking::findOrFail($response->json('data.id'));
    expect($new->request_expires_at->timestamp)->toBe(now()->addMinutes(10)->timestamp);
    expect($this->ride->fresh()->request_outcome)->toBe('superseded');
    expect($this->ride->fresh()->status)->toBe('cancelled');
});

it('expires at the exact deadline and retains paid request refund evidence once', function () {
    $this->freezeTime();
    $this->ride->update(['status' => 'pending', 'driver_id' => null, 'payment_method' => 'card',
        'payment_status' => 'paid', 'request_expires_at' => now()]);
    expect(app(RideRequestLifecycle::class)->expire())->toBe(1);
    expect(app(RideRequestLifecycle::class)->expire())->toBe(0);
    expect($this->ride->fresh()->request_outcome)->toBe('expired');
    expect($this->ride->refunds()->count())->toBe(1);
    expect((float) $this->ride->refunds()->first()->amount)->toBe(100.0);
    expect($this->ride->refunds()->first()->status)->toBe('pending');
});

it('releases the driver when a customer cancels at each active state', function (string $status) {
    $this->ride->update(['status' => $status]);
    Sanctum::actingAs($this->customer);
    $this->postJson('/api/customer-app/rides/'.$this->ride->id.'/cancel', ['reason' => 'Plans changed'])->assertOk();
    expect($this->availability->fresh()->status)->toBe('online')->and($this->availability->fresh()->is_available)->toBeTrue();
    expect($this->ride->fresh()->status)->toBe('cancelled');
})->with(['driver_assigned', 'driver_arriving', 'pickup', 'in_transit']);

it('allows owned pre-trip driver cancellation and requires a reason', function () {
    Sanctum::actingAs($this->driver);
    $url = '/api/driver-app/rides/'.$this->ride->id.'/cancel';
    $this->postJson($url, [])->assertUnprocessable();
    $this->postJson($url, ['reason' => 'Customer did not arrive'])->assertOk();
    $this->postJson($url, ['reason' => 'Retry'])->assertOk();
    expect($this->ride->auditLogs()->where('action', 'booking.cancelled')->count())->toBe(1);
    expect($this->availability->fresh()->status)->toBe('online');
});

it('rejects foreign and in-transit driver cancellations', function () {
    $other = Driver::create(['name' => 'Other', 'phone' => '8000012357', 'is_active' => true]);
    Sanctum::actingAs($other);
    $this->postJson('/api/driver-app/rides/'.$this->ride->id.'/cancel', ['reason' => 'No show'])->assertForbidden();
    Sanctum::actingAs($this->driver);
    $this->ride->update(['status' => 'in_transit']);
    $this->postJson('/api/driver-app/rides/'.$this->ride->id.'/cancel', ['reason' => 'No show'])->assertUnprocessable();
    expect($this->availability->fresh()->status)->toBe('on_ride');
});

it('does not release a driver who has another active ride', function () {
    $other = $this->ride->replicate(['booking_number']);
    $other->save();
    app(BookingCancellationService::class)->cancel($this->ride, 'ride');
    expect($this->availability->fresh()->status)->toBe('on_ride');
});

it('recovers orphaned drivers without inventing a fresh GPS heartbeat', function () {
    $this->ride->update(['status' => 'cancelled']);
    $this->availability->update(['last_updated' => now()->subDay()]);
    $timestamp = $this->availability->last_updated;
    $dispatch = app(\App\Services\DriverDispatchService::class);
    expect($dispatch->recoverOrphanedAvailability())->toBe(1);
    expect($this->availability->fresh()->status)->toBe('offline');
    expect($this->availability->fresh()->last_updated->eq($timestamp))->toBeTrue();
    expect($dispatch->recoverOrphanedAvailability())->toBe(0);
});

it('never recovers availability belonging to an active ride', function () {
    expect(app(\App\Services\DriverDispatchService::class)->recoverOrphanedAvailability())->toBe(0);
    expect($this->availability->fresh()->status)->toBe('on_ride');
});

it('records an owned driver issue without ending an in-transit trip', function () {
    $this->ride->update(['status' => 'in_transit']);
    Sanctum::actingAs($this->driver);
    $this->postJson('/api/driver-app/rides/'.$this->ride->id.'/issues', ['description' => 'Vehicle needs assistance'])->assertCreated();
    expect($this->ride->incidents()->count())->toBe(1);
    expect($this->ride->fresh()->status)->toBe('in_transit');
});

it('does not dispatch a scheduled ride before its window', function () {
    $this->ride->update(['status' => 'pending', 'driver_id' => null, 'scheduled_at' => now()->addDay()]);
    expect(app(\App\Services\DriverDispatchService::class)->dispatchDueRides())->toBe(0);
    expect($this->ride->dispatchAttempts()->count())->toBe(0);
});

it('records cash collection once with balanced entries and rejects electronic settlement', function () {
    $this->ride->update(['status' => 'completed']);
    $service = app(\App\Services\PaymentService::class);
    $first = $service->recordCashCollection($this->ride, $this->driver->id, 'Collected INR 100');
    $again = $service->recordCashCollection($this->ride, $this->driver->id, 'Retry');
    expect($again->id)->toBe($first->id);
    expect(\App\Models\LedgerEntry::where('reference_type', RideBooking::class)->where('reference_id', $this->ride->id)->count())->toBe(2);
    Sanctum::actingAs($this->driver);
    $this->postJson('/api/driver-app/rides/'.$this->ride->id.'/payment-status', ['payment_status' => 'refunded', 'payment_method' => 'card'])->assertUnprocessable();
});

it('completes a cash ride without inventing collection evidence', function () {
    $this->ride->update(['status' => 'in_transit']);
    Sanctum::actingAs($this->driver);
    $this->postJson('/api/driver-app/tracking/ride/'.$this->ride->id.'/status', ['status' => 'completed'])->assertOk();
    expect($this->ride->fresh()->payment_status)->toBe('pending');
    expect($this->ride->payments()->count())->toBe(0);
});

it('expires abandoned pickups but only flags long running trips once', function () {
    $this->ride->update(['driver_assigned_at' => now()->subHours(3)]);
    expect(app(RideRequestLifecycle::class)->expireStaleAssignedRides())->toBe(1);
    expect($this->availability->fresh()->status)->toBe('online');
    $this->ride->update(['status' => 'in_transit', 'started_at' => now()->subDays(2)]);
    $this->availability->refresh()->update(['status' => 'on_ride', 'is_available' => false]);
    expect(app(RideRequestLifecycle::class)->expireStaleAssignedRides())->toBe(0);
    app(RideRequestLifecycle::class)->expireStaleAssignedRides();
    expect($this->ride->fresh()->status)->toBe('in_transit');
    expect($this->ride->auditLogs()->where('action', 'ride.stale_review')->count())->toBe(1);
    expect($this->availability->fresh()->status)->toBe('on_ride');
});

it('reconciles a cash receipt and does not credit earnings already held by the driver', function () {
    $this->ride->update(['status' => 'completed']);
    $service = app(\App\Services\PaymentService::class);
    $payment = $service->recordCashCollection($this->ride, $this->driver->id, 'Collected from passenger');
    $service->recordCashCollection($this->ride, $this->driver->id, 'Repeated request');
    app(\App\Services\CommissionService::class)->settleRide($this->ride->fresh());
    app(\App\Services\CommissionService::class)->settleRide($this->ride->fresh());
    expect($payment->fresh()->notes['ledger_transaction_ref'])->not->toBeEmpty();
    $report = app(\App\Services\CashCollectionReconciliation::class)->run();
    expect($report['checked'])->toBe(1)->and($report['collected_minor'])->toBe(10000)->and($report['issues'])->toBe([]);
    expect(\App\Models\WalletTransaction::where('reference_type', 'driver_earning')->count())->toBe(0);
    expect(\App\Models\LedgerEntry::count())->toBe(2);
    $this->artisan('rides:reconcile-cash', ['--json' => true])->assertSuccessful();
});

it('reports a missing cash ledger leg without repairing or concealing it', function () {
    $this->ride->update(['status' => 'completed']);
    $payment = app(\App\Services\PaymentService::class)->recordCashCollection($this->ride, $this->driver->id, 'Cash receipt');
    \App\Models\LedgerEntry::where('transaction_ref', $payment->notes['ledger_transaction_ref'])->where('direction', 'credit')->delete();
    $report = app(\App\Services\CashCollectionReconciliation::class)->run();
    expect(array_column($report['issues'], 'code'))->toContain('ledger_mismatch');
    $this->artisan('rides:reconcile-cash')->assertFailed();
    expect(\App\Models\LedgerEntry::count())->toBe(1);
    expect($this->ride->fresh()->payment_status)->toBe('paid');
});

it('reports legacy paid cash bookings with no receipt', function () {
    $this->ride->update(['status' => 'completed', 'payment_status' => 'paid']);
    $report = app(\App\Services\CashCollectionReconciliation::class)->run();
    expect(array_column($report['issues'], 'code'))->toContain('paid_without_receipt');
    expect($this->ride->payments()->count())->toBe(0);
});

it('detects cash receipts incorrectly credited again to the driver wallet', function () {
    $this->ride->update(['status' => 'completed']);
    app(\App\Services\PaymentService::class)->recordCashCollection($this->ride, $this->driver->id, 'Cash receipt');
    $wallet = \App\Models\Wallet::create(['owner_type' => Driver::class, 'owner_id' => $this->driver->id, 'balance' => 0, 'is_active' => true, 'currency' => 'INR']);
    $wallet->credit(80, 'Incorrect legacy settlement', 'driver_earning', 'ride_booking:'.$this->ride->id);
    $report = app(\App\Services\CashCollectionReconciliation::class)->run();
    expect(array_column($report['issues'], 'code'))->toContain('cash_also_credited_to_wallet');
    expect((float) $wallet->fresh()->balance)->toBe(80.0);
});

<?php

use App\Models\CarpoolPolicy;
use App\Models\Customer;
use App\Models\Payment;
use App\Services\CarpoolPayments;
use App\Services\CarpoolPricing;
use App\Services\CarpoolService;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../Support/CarpoolFixtures.php';

it('handles no-shows only after the grace period and refunds the configured online contribution', function () {
    config(['carpool.test_payments' => true]);
    [$ride, $driver] = carpoolFixture();
    $p = carpoolPassenger();
    $b = carpoolBook($ride, $p, 'online');
    $payments = app(CarpoolPayments::class);
    $order = $payments->checkout($p, $b->id);
    $payments->capture($order, 'no-show-payment', $order->amount_minor, 'INR');
    expect(fn () => app(CarpoolService::class)->bookingAction($driver, $b->id, 'no-show'))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    $this->travelTo($ride->departure_at->copy()->addMinutes(16));
    app(CarpoolService::class)->bookingAction($driver, $b->id, 'no-show');
    expect($b->fresh()->attendance)->toBe('no_show')->and($b->fresh()->refund_minor)->toBe($b->total_minor);
    $payments->settle($b->id);
    expect($b->fresh()->refund_status)->toBe('refunded')->and($payments->eligible($b->fresh()))->toBeFalse();
});

it('versions admin pricing policies and records the audit rationale', function () {
    [, , , $policy] = carpoolFixture();
    $admin = \App\Models\User::factory()->create();
    $role = \App\Models\Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Administrator']);
    $admin->roles()->attach($role->id);
    $this->actingAs($admin, 'web');
    $rules = [...$policy->rules, 'payment_methods' => ['cash'], 'no_show_refund_bps' => 10000];
    $this->post('/admin/carpool/policies', ['region' => $policy->region, 'currency' => 'INR', 'enabled' => false, 'rules' => $rules])->assertRedirect();
    expect(CarpoolPolicy::where('region', $policy->region)->max('version'))->toBe(2);
    $this->get('/admin/carpool')->assertOk();
    $this->assertDatabaseHas('booking_audit_logs', ['action' => 'carpool.policy.created']);
});

it('locks registered vehicle identity and capacity while carpool participants hold accepted terms', function () {
    [$ride, , $vehicle] = carpoolFixture();
    carpoolBook($ride);
    expect(fn () => $vehicle->update(['seats' => 3]))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    expect($vehicle->fresh()->seats)->toBe(4);
});

it('publishes safe cost snapshots and rejects price capacity route and past departure violations', function () {
    [$ride, $driver, $vehicle, $policy, $data] = carpoolFixture();
    expect($ride->pricing_snapshot['fuel_minor'])->toBe(105000)->and($ride->pricing_snapshot['max_total_minor'])->toBe(79500);
    foreach ([['price_minor' => 1000000], ['seats' => 4], ['departure_at' => now()->subDay()->toIso8601String()], ['distance_m' => 1000], ['destination_lat' => 20]] as $change) {
        expect(fn () => app(CarpoolService::class)->save($driver, array_replace($data, $change), $ride->id))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    }
    $snapshot = app(CarpoolPricing::class)->quote($policy, $vehicle, 150000, 1000, 3);
    expect($snapshot['max_seat_minor'] * 3)->toBeLessThanOrEqual($snapshot['max_total_minor']);
});

it('admits only one last-seat booking and replays the same request without consuming seats twice', function () {
    [$ride] = carpoolFixture();
    $passenger = carpoolPassenger();
    $first = carpoolBook($ride, $passenger, 'cash', 'stable-key-123');
    expect(carpoolBook($ride, $passenger, 'cash', 'stable-key-123')->id)->toBe($first->id);
    expect(fn () => carpoolBook($ride))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    expect(app(CarpoolService::class)->remaining($ride))->toBe(0);
});

it('does not reserve unapproved requests and rechecks availability at approval', function () {
    [$ride, $driver] = carpoolFixture(['booking_mode' => 'approval']);
    $a = carpoolBook($ride);
    $b = carpoolBook($ride);
    expect(app(CarpoolService::class)->remaining($ride))->toBe(1);
    app(CarpoolService::class)->bookingAction($driver, $a->id, 'approve');
    expect(fn () => app(CarpoolService::class)->bookingAction($driver, $b->id, 'approve'))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    expect($b->fresh()->status)->toBe('requested');
});

it('expires reservations and releases cancelled capacity exactly once', function () {
    config(['carpool.test_payments' => true]);
    [$ride] = carpoolFixture();
    $passenger = carpoolPassenger();
    $held = carpoolBook($ride, $passenger, 'online');
    expect($held->status)->toBe('reserved');
    $this->travel(11)->minutes();
    $next = carpoolBook($ride);
    expect($held->fresh()->status)->toBe('expired')->and($next->status)->toBe('confirmed');
    $service = app(CarpoolService::class);
    $service->bookingAction($next->passenger, $next->id, 'cancel');
    $service->bookingAction($next->passenger, $next->id, 'cancel');
    expect($service->remaining($ride))->toBe(1);
});

it('captures idempotently and refunds late captures without reoccupying released seats', function () {
    config(['carpool.test_payments' => true]);
    [$ride] = carpoolFixture();
    $passenger = carpoolPassenger();
    $b = carpoolBook($ride, $passenger, 'online');
    $payments = app(CarpoolPayments::class);
    $order = $payments->prepareOrder($payments->checkout($passenger, $b->id));
    $this->travel(11)->minutes();
    $next = carpoolBook($ride);
    $payments->capture($order, 'capture-late', $order->amount_minor, 'INR');
    $payments->capture($order, 'capture-late', $order->amount_minor, 'INR');
    expect(Payment::where('provider_payment_id', 'capture-late')->count())->toBe(1)->and($b->fresh()->refund_status)->toBe('pending')->and($b->fresh()->status)->toBe('expired');
    $payments->settle($b->id);
    expect($b->fresh()->refund_status)->toBe('refunded')->and($next->fresh()->status)->toBe('confirmed');
});

it('verifies webhook signatures and deduplicates captured events', function () {
    config(['carpool.test_payments' => true, 'services.razorpay.webhook_secret' => 'carpool-secret']);
    [$ride] = carpoolFixture();
    $p = carpoolPassenger();
    $b = carpoolBook($ride, $p, 'online');
    $order = app(CarpoolPayments::class)->checkout($p, $b->id);
    $order->update(['provider' => 'razorpay', 'provider_order_id' => 'order_carpool']);
    $payload = json_encode(['event' => 'payment.captured', 'payload' => ['payment' => ['entity' => ['id' => 'payment_carpool', 'order_id' => 'order_carpool', 'amount' => $b->total_minor, 'currency' => 'INR']]]]);
    $this->call('POST', '/api/carpool/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_RAZORPAY_SIGNATURE' => 'invalid'], $payload)->assertUnauthorized();
    for ($i = 0; $i < 2; $i++) {
        $this->call('POST', '/api/carpool/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_RAZORPAY_SIGNATURE' => hash_hmac('sha256', $payload, 'carpool-secret')], $payload)->assertOk();
    }
    expect($b->fresh()->status)->toBe('confirmed')->and(Payment::where('provider_payment_id', 'payment_carpool')->count())->toBe(1);
});

it('requires completion and dispute-window expiry for online payouts and never pays out cash', function () {
    config(['carpool.test_payments' => true]);
    [$ride, $driver] = carpoolFixture();
    $p = carpoolPassenger();
    $b = carpoolBook($ride, $p, 'online');
    $payments = app(CarpoolPayments::class);
    $order = $payments->prepareOrder($payments->checkout($p, $b->id));
    $payments->capture($order, 'test-paid', $order->amount_minor, 'INR');
    expect($payments->eligible($b->fresh()))->toBeFalse();
    $this->travelTo($ride->departure_at);
    app(CarpoolService::class)->bookingAction($driver, $b->id, 'check-in', ['pin' => $b->pin]);
    app(CarpoolService::class)->rideAction($driver, $ride->id, 'start');
    app(CarpoolService::class)->rideAction($driver, $ride->id, 'complete');
    expect($payments->eligible($b->fresh()))->toBeFalse();
    $this->travel(25)->hours();
    expect($payments->eligible($b->fresh()))->toBeTrue();
    $payments->settle($b->id);
    $payments->settle($b->id);
    expect($b->fresh()->payout_status)->toBe('test_paid');
    $b->update(['payment_method' => 'cash']);
    expect($payments->eligible($b->fresh()))->toBeFalse();
});

it('blocks self booking unauthorized changes and reviews before completion and hides private data', function () {
    [$ride, $driver, , , $data] = carpoolFixture();
    $p = carpoolPassenger();
    $b = carpoolBook($ride, $p);
    Sanctum::actingAs(carpoolPassenger());
    $this->postJson('/api/carpool/bookings/'.$b->id.'/cancel')->assertForbidden();
    $this->postJson('/api/carpool/bookings/'.$b->id.'/review', ['rating' => 5, 'body' => 'Great'])->assertForbidden();
    $this->getJson('/api/carpool/rides/'.$ride->id)->assertOk()->assertJsonMissingPath('data.meeting')->assertJsonMissingPath('data.driver.phone');
    Sanctum::actingAs($p);
    $this->postJson('/api/carpool/bookings/'.$b->id.'/review', ['rating' => 5, 'body' => 'Great'])->assertUnprocessable();
    expect(fn () => app(CarpoolService::class)->save($driver, $data, $ride->id))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    app(CarpoolService::class)->bookingAction($p, $b->id, 'cancel');
    $linked = Customer::create(['name' => 'Driver passenger', 'phone' => $driver->phone, 'phone_verified_at' => now(), 'is_active' => true]);
    expect(fn () => carpoolBook($ride, $linked))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
});

it('queues a full online refund when the driver cancels and preserves accepted policy snapshots', function () {
    config(['carpool.test_payments' => true]);
    [$ride, $driver, , $policy] = carpoolFixture();
    $p = carpoolPassenger();
    $b = carpoolBook($ride, $p, 'online');
    $payments = app(CarpoolPayments::class);
    $order = $payments->prepareOrder($payments->checkout($p, $b->id));
    $payments->capture($order, 'paid-cancel', $order->amount_minor, 'INR');
    CarpoolPolicy::create(['region' => $policy->region, 'version' => 2, 'enabled' => false, 'currency' => 'INR', 'rules' => $policy->rules]);
    app(CarpoolService::class)->rideAction($driver, $ride->id, 'cancel');
    expect($b->fresh()->refund_minor)->toBe($b->total_minor)->and($b->fresh()->terms['pricing']['version'])->toBe(1);
    $payments->settle($b->id);
    expect($b->fresh()->refund_status)->toBe('refunded');
});

it('uses existing verified driver documents and allows a linked verified customer to offer', function () {
    [$ride, $driver, , , $data] = carpoolFixture();
    $linked = Customer::create(['name' => 'Same person', 'phone' => $driver->phone, 'phone_verified_at' => now(), 'is_active' => true]);
    Sanctum::actingAs($linked);
    $this->getJson('/api/carpool/options')->assertOk()->assertJsonPath('data.can_offer', true);
    $this->putJson('/api/carpool/rides/'.$ride->id, $data)->assertOk();
    $driver->documents()->where('type', 'government_id')->update(['status' => 'rejected']);
    $this->putJson('/api/carpool/rides/'.$ride->id, $data)->assertForbidden();
    $this->getJson('/api/carpool/rides/'.$ride->id)->assertOk()->assertJsonPath('data.driver.verified', false);
});

it('enforces request identity terms aggregate caps and regional shutdown at booking time', function () {
    [$ride, , , $policy] = carpoolFixture(['seats' => 3]);
    $p = carpoolPassenger();
    $first = carpoolBook($ride, $p, 'cash', 'same-request');
    expect(fn () => carpoolBook($ride, $p))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    $snap = $ride->pricing_snapshot;
    $snap['max_total_minor'] = 5000;
    $ride->update(['pricing_snapshot' => $snap]);
    expect(fn () => carpoolBook($ride))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
    $ride->update(['pricing_snapshot' => $first->terms['pricing']]);
    CarpoolPolicy::create(['region' => $policy->region, 'version' => 2, 'enabled' => false, 'currency' => 'INR', 'rules' => $policy->rules]);
    expect(fn () => carpoolBook($ride))->toThrow(\Symfony\Component\HttpKernel\Exception\HttpException::class);
});

it('routes the existing webhook job through carpool and does not double refund callbacks', function () {
    config(['carpool.test_payments' => true]);
    [$ride, $driver] = carpoolFixture();
    $p = carpoolPassenger();
    $b = carpoolBook($ride, $p, 'online');
    $payments = app(CarpoolPayments::class);
    $order = $payments->checkout($p, $b->id);
    $order->update(['provider_order_id' => 'cp-shared-order']);
    $event = \App\Models\RazorpayWebhookEvent::create(['provider' => 'razorpay', 'event_id' => 'cp-shared-event', 'event_type' => 'payment.captured',
        'payload' => ['payload' => ['payment' => ['entity' => ['id' => 'cp-shared-payment', 'order_id' => 'cp-shared-order', 'amount' => $b->total_minor, 'currency' => 'INR']]]], 'status' => 'received']);
    app()->call([new \App\Jobs\ProcessRazorpayWebhookEvent($event->id), 'handle']);
    expect($b->fresh()->status)->toBe('confirmed');
    app(CarpoolService::class)->rideAction($driver, $ride->id, 'cancel');
    $payments->settle($b->id);
    $payment = $b->payments()->first();
    $ledgerCount = \App\Models\LedgerEntry::count();
    $payments->recordRefund($payment, $b->total_minor, 'test_refund_'.$payment->id.'_'.$b->total_minor);
    expect(\App\Models\LedgerEntry::count())->toBe($ledgerCount)->and($b->fresh()->payment_status)->toBe('refunded');
});

it('refunds only an additional capture while preserving the legitimate booking payment', function () {
    config(['carpool.test_payments' => true]);
    [$ride] = carpoolFixture();
    $p = carpoolPassenger();
    $b = carpoolBook($ride, $p, 'online');
    $payments = app(CarpoolPayments::class);
    $order = $payments->checkout($p, $b->id);
    $payments->capture($order, 'primary-payment', $order->amount_minor, 'INR');
    $payments->capture($order, 'additional-payment', $order->amount_minor, 'INR');
    $payments->settle($b->id);
    expect(Payment::where('provider_payment_id', 'primary-payment')->first()->amount_refunded_minor)->toBe(0)
        ->and(Payment::where('provider_payment_id', 'additional-payment')->first()->amount_refunded_minor)->toBe($b->total_minor)
        ->and($b->fresh()->status)->toBe('confirmed')->and($b->fresh()->payment_status)->toBe('paid');
});

it('allows one review per completed counterpart and blocks payout during an open dispute', function () {
    config(['carpool.test_payments' => true]);
    [$ride, $driver] = carpoolFixture();
    $p = carpoolPassenger();
    $b = carpoolBook($ride, $p, 'online');
    $payments = app(CarpoolPayments::class);
    $order = $payments->checkout($p, $b->id);
    $payments->capture($order, 'review-payment', $order->amount_minor, 'INR');
    $this->travelTo($ride->departure_at);
    $service = app(CarpoolService::class);
    $service->bookingAction($driver, $b->id, 'check-in', ['pin' => $b->pin]);
    $service->rideAction($driver, $ride->id, 'start');
    $service->rideAction($driver, $ride->id, 'complete');
    Sanctum::actingAs($p);
    $this->postJson('/api/carpool/bookings/'.$b->id.'/review', ['rating' => 5, 'body' => 'On time and helpful'])->assertOk();
    $this->postJson('/api/carpool/bookings/'.$b->id.'/review', ['rating' => 5, 'body' => 'Again'])->assertConflict();
    $this->postJson('/api/carpool/bookings/'.$b->id.'/complaint', ['body' => 'Please investigate this payment'])->assertOk();
    $this->travel(25)->hours();
    expect($payments->eligible($b->fresh()))->toBeFalse();
    Sanctum::actingAs($driver);
    $this->postJson('/api/carpool/bookings/'.$b->id.'/review', ['rating' => 5, 'body' => 'Good passenger'])->assertOk();
});

it('releases a failed checkout and excludes unconfirmed participants from meeting details', function () {
    config(['carpool.test_payments' => true]);
    [$ride] = carpoolFixture();
    $p = carpoolPassenger();
    $b = carpoolBook($ride, $p, 'online');
    Sanctum::actingAs($p);
    $this->getJson('/api/carpool/mine')->assertOk()->assertJsonMissingPath('data.bookings.0.meeting')->assertJsonMissingPath('data.bookings.0.pin');
    $payments = app(CarpoolPayments::class);
    $order = $payments->checkout($p, $b->id);
    $payments->fail($order);
    expect($b->fresh()->payment_status)->toBe('failed')->and(app(CarpoolService::class)->remaining($ride))->toBe(1);
    $this->postJson('/admin/carpool/policies', [])->assertForbidden();
});

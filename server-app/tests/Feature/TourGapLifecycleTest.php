<?php

use App\Models\Customer;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourSchedule;
use App\Services\PaymentService;
use App\Services\TourSearchService;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Event::fake([\App\Events\BookingLifecycleNotification::class]);
    $this->customer = Customer::create(['name' => 'Tour customer', 'phone' => '9000099911', 'is_active' => true]);
    $this->tour = Tour::create(['title' => 'Lifecycle tour', 'slug' => 'lifecycle-tour', 'duration_days' => 1, 'duration_nights' => 0, 'price_per_person' => 1000, 'child_price' => 500, 'is_active' => true]);
    $this->schedule = TourSchedule::create(['tour_id' => $this->tour->id, 'departure_date' => now()->addWeek()->toDateString(), 'return_date' => now()->addWeek()->toDateString(), 'departure_time' => '09:00', 'total_seats' => 10, 'reserved_seats' => 2, 'booked_seats' => 0, 'status' => 'open']);
    $this->booking = TourBooking::create(['customer_id' => $this->customer->id, 'tour_id' => $this->tour->id, 'tour_schedule_id' => $this->schedule->id, 'number_of_adults' => 2, 'number_of_children' => 0, 'travel_date' => $this->schedule->departure_date, 'customer_name' => 'Tour customer', 'customer_phone' => $this->customer->phone, 'price_per_adult' => 1000, 'price_per_child' => 500, 'subtotal' => 2000, 'total_price' => 2000, 'status' => 'pending', 'payment_status' => 'pending', 'payment_method' => 'cash', 'hold_expires_at' => now()->addMinutes(30)]);
});

it('converts a held tour reservation exactly once when payment is captured', function () {
    $data = ['provider_payment_id' => 'pay_gap_tour', 'amount_minor' => 200000, 'payable' => $this->booking, 'method' => 'upi'];
    app(PaymentService::class)->recordCapturedPayment($data);
    app(PaymentService::class)->recordCapturedPayment($data);
    expect($this->booking->fresh()->status)->toBe('confirmed')->and($this->booking->fresh()->hold_expires_at)->toBeNull();
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(0)->and((int) $this->schedule->fresh()->booked_seats)->toBe(2);
});

it('records a wallet payment and converts seats without duplicating its ledger movement', function () {
    $wallet = \App\Models\Wallet::create(['owner_type' => Customer::class, 'owner_id' => $this->customer->id,
        'balance' => 2000, 'balance_minor' => 200000, 'currency' => 'INR', 'is_active' => true]);
    $service = app(PaymentService::class);
    $service->payTourWithWallet($this->booking);
    $service->payTourWithWallet($this->booking);
    expect((int) $wallet->fresh()->balance_minor)->toBe(0);
    expect($this->booking->payments()->count())->toBe(1);
    expect(\App\Models\LedgerEntry::count())->toBe(2);
    expect($this->booking->fresh()->status)->toBe('confirmed');
    expect((int) $this->schedule->fresh()->booked_seats)->toBe(2);
});

it('does not record an admin receipt or convert inventory after a tour hold expires', function () {
    $this->booking->update(['hold_expires_at' => now()->subMinute()]);
    expect(fn () => app(PaymentService::class)->recordAdminReceipt($this->booking, 'cash', 'counter-receipt', 1))
        ->toThrow(\Illuminate\Validation\ValidationException::class);
    expect($this->booking->payments()->count())->toBe(0);
    expect(\App\Models\LedgerEntry::count())->toBe(0);
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(2);
    expect((int) $this->schedule->fresh()->booked_seats)->toBe(0);
});

it('expires unpaid holds and releases their seats once', function () {
    $this->booking->update(['hold_expires_at' => now()->subMinute()]);
    $this->artisan('tours:expire-holds')->assertSuccessful();
    $this->artisan('tours:expire-holds')->assertSuccessful();
    expect($this->booking->fresh()->status)->toBe('cancelled');
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(0);
    expect($this->booking->auditLogs()->where('action', 'booking.cancelled')->count())->toBe(1);
});

it('expires an unpaid hold at the exact deadline', function () {
    $this->freezeSecond();
    $this->booking->update(['hold_expires_at' => now()]);
    $this->artisan('tours:expire-holds')->expectsOutput('Expired 1 tour holds.')->assertSuccessful();
    $this->artisan('tours:expire-holds')->expectsOutput('Expired 0 tour holds.')->assertSuccessful();
    expect($this->booking->fresh()->status)->toBe('cancelled');
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(0);
});

it('preserves funded and refunded pending bookings for lifecycle review', function (string $paymentStatus) {
    $this->booking->update(['payment_status' => $paymentStatus, 'hold_expires_at' => now()->subMinute()]);
    $this->artisan('tours:expire-holds')->expectsOutput('Expired 0 tour holds.')->assertSuccessful();
    $report = app(\App\Services\TourInventoryReconciliation::class)->run(true);
    expect($report['protected_pending'])->toBe(1);
    expect($this->booking->fresh()->status)->toBe('pending');
    expect($this->booking->fresh()->payment_status)->toBe($paymentStatus);
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(2);
    expect($this->booking->refunds()->count())->toBe(0);
})->with(['partial', 'paid', 'refunded']);

it('does not expire a confirmed partial payment with an old hold deadline', function () {
    $this->booking->update(['status' => 'confirmed', 'payment_status' => 'partial', 'hold_expires_at' => now()->subMinute()]);
    $this->schedule->update(['reserved_seats' => 0, 'booked_seats' => 2]);
    $this->artisan('tours:expire-holds')->expectsOutput('Expired 0 tour holds.')->assertSuccessful();
    expect($this->booking->fresh()->status)->toBe('confirmed');
    expect((int) $this->schedule->fresh()->booked_seats)->toBe(2);
});

it('rejects confirmation at the exact deadline and refunds a capture once', function () {
    $this->freezeSecond();
    $this->booking->update(['hold_expires_at' => now()]);
    $service = app(PaymentService::class);
    expect(fn () => $service->recordAdminReceipt($this->booking, 'cash', 'deadline-receipt', 1))
        ->toThrow(\Illuminate\Validation\ValidationException::class);
    $data = ['provider_payment_id' => 'pay_exact_deadline', 'amount_minor' => 200000, 'payable' => $this->booking, 'method' => 'upi'];
    $service->recordCapturedPayment($data);
    $service->recordCapturedPayment($data);
    expect($this->booking->fresh()->status)->toBe('cancelled');
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(0);
    expect((int) $this->schedule->fresh()->booked_seats)->toBe(0);
    expect($this->booking->refunds()->count())->toBe(1);
});

it('releases the correct inventory bucket regardless of payment state', function (string $status, string $paymentStatus) {
    $this->booking->update(['status' => $status, 'payment_status' => $paymentStatus]);
    $this->schedule->update(['reserved_seats' => 4, 'booked_seats' => 4]);
    $service = app(\App\Services\BookingCancellationService::class);
    $service->cancel($this->booking, 'tour', 'Operations cancellation', null, 'system');
    $service->cancel($this->booking, 'tour', 'Repeated cancellation', null, 'system');
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe($status === 'pending' ? 2 : 4);
    expect((int) $this->schedule->fresh()->booked_seats)->toBe($status === 'pending' ? 4 : 2);
})->with([['in_progress', 'pending'], ['confirmed', 'pending'], ['pending', 'paid']]);

it('reports missing unpaid deadlines without inventing an expiry or releasing seats', function () {
    $this->booking->update(['hold_expires_at' => null]);
    $report = app(\App\Services\TourInventoryReconciliation::class)->run(true);
    expect($report['missing_deadline'])->toBe(1);
    expect($this->booking->fresh()->hold_expires_at)->toBeNull();
    expect($this->booking->fresh()->status)->toBe('pending');
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(2);
});

it('keeps late captures and creates one refund liability without reclaiming released seats', function (bool $sweepFirst) {
    $this->booking->update(['hold_expires_at' => now()->subMinute()]);
    if ($sweepFirst) {
        $this->artisan('tours:expire-holds')->assertSuccessful();
    }
    $data = ['provider_payment_id' => 'pay_gap_late', 'amount_minor' => 200000, 'payable' => $this->booking, 'method' => 'upi'];
    $service = app(PaymentService::class);
    $payment = $service->recordCapturedPayment($data);
    $service->recordCapturedPayment($data);
    expect($payment->isCaptured())->toBeTrue();
    expect($this->booking->fresh()->status)->toBe('cancelled');
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(0)->and((int) $this->schedule->fresh()->booked_seats)->toBe(0);
    expect($this->booking->refunds()->count())->toBe(1)->and($this->booking->refunds()->first()->status)->toBe('pending');
    expect(\App\Models\LedgerEntry::where('reference_type', TourBooking::class)->where('reference_id', $this->booking->id)->count())->toBe(2);
})->with([true, false]);

it('does not confirm an underpayment or reopen a refunded capture on replay', function () {
    $service = app(PaymentService::class);
    $data = ['provider_payment_id' => 'pay_gap_wrong_amount', 'amount_minor' => 100000, 'payable' => $this->booking, 'method' => 'upi'];
    $payment = $service->recordCapturedPayment($data);
    expect($this->booking->fresh()->status)->toBe('pending')->and($this->booking->fresh()->payment_status)->toBe('pending');
    $payment->update(['status' => \App\Models\Payment::STATUS_REFUNDED]);
    expect($service->recordCapturedPayment($data)->status)->toBe(\App\Models\Payment::STATUS_REFUNDED);
    expect($this->booking->refunds()->count())->toBe(1);
});

it('uses the local departure time rather than midnight for discovery', function () {
    $this->travelTo(\Carbon\Carbon::parse('2026-09-22 06:00:00', 'UTC'));
    $this->schedule->update(['departure_date' => '2026-09-22', 'return_date' => '2026-09-22', 'departure_time' => '14:00']);
    expect(app(TourSearchService::class)->query([])->whereKey($this->tour->id)->exists())->toBeTrue();
    $this->schedule->update(['departure_time' => '10:00']);
    expect(app(TourSearchService::class)->query([])->whereKey($this->tour->id)->exists())->toBeFalse();
});

it('reports inventory drift and repairs only when explicitly requested', function () {
    $this->schedule->update(['reserved_seats' => 8, 'booked_seats' => 3]);
    $service = app(\App\Services\TourInventoryReconciliation::class);
    expect($service->run()['mismatched'])->toBe(1);
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(8);
    expect($service->run(true)['repaired'])->toBe(1);
    expect((int) $this->schedule->fresh()->reserved_seats)->toBe(2)->and((int) $this->schedule->fresh()->booked_seats)->toBe(0);
    expect($service->run(true)['repaired'])->toBe(0);
});

it('requires a quote for the version two booking contract', function () {
    Sanctum::actingAs($this->customer);
    $this->postJson('/api/customer-app/tours/book', ['tour_id' => $this->tour->id, 'tour_schedule_id' => $this->schedule->id, 'number_of_adults' => 1, 'payment_method' => 'cash'], ['X-Booking-Contract' => '2'])->assertUnprocessable()->assertJsonValidationErrors('quote_token');
});

it('rejects unsupported electronic tour checkout before creating a booking', function () {
    Sanctum::actingAs($this->customer);
    $this->postJson('/api/customer-app/tours/book', ['tour_id' => $this->tour->id, 'tour_schedule_id' => $this->schedule->id, 'number_of_adults' => 1, 'payment_method' => 'upi'])
        ->assertUnprocessable()->assertJsonValidationErrors('payment_method');
    expect(TourBooking::count())->toBe(1);
});

it('requires the correct tour rating field and preserves separate driver feedback', function () {
    $this->booking->update(['status' => 'completed']);
    Sanctum::actingAs($this->customer);
    $url = '/api/customer-app/tour-bookings/'.$this->booking->id.'/review';
    $this->postJson($url, ['rating' => 5])->assertUnprocessable()->assertJsonValidationErrors('tour_rating');
    $this->postJson($url, ['tour_rating' => 4, 'driver_rating' => 3])->assertOk()->assertJsonPath('data.tour_rating', 4)->assertJsonPath('data.driver_rating', 3);
});

it('lists invitations only for the authenticated verified phone without exposing secrets', function () {
    $share = \App\Models\TourShare::create(['tour_booking_id' => $this->booking->id, 'name' => 'Guest', 'phone' => '+91'.$this->customer->phone, 'token_hash' => hash('sha256', 'secret'), 'expires_at' => now()->addHour()]);
    Sanctum::actingAs($this->customer);
    $url = '/api/customer-app/tour-shares/invitations';
    $this->getJson($url)->assertForbidden();
    $this->customer->update(['phone_verified_at' => now()]);
    $this->getJson($url)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $share->id)->assertJsonMissingPath('data.0.token_hash')->assertJsonMissingPath('data.0.phone');
    $other = Customer::create(['name' => 'Other', 'phone' => '9000099922', 'phone_verified_at' => now()]);
    Sanctum::actingAs($other);
    $this->getJson($url)->assertOk()->assertJsonCount(0, 'data');
});

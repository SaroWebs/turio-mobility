<?php

use App\Models\Customer;
use App\Models\LedgerAccount;
use App\Models\LedgerEntry;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourSchedule;
use App\Services\BookingCancellationService;
use App\Services\BookingStatusService;
use App\Support\Money;

/**
 * Item #4: a wallet booking refund must post its counterparty leg to
 * system:refunds (not the general clearing account), so refunds are
 * distinguishable from revenue in the ledger (SKY-MRD-001 §8.6/§8.7).
 */
it('routes a wallet booking refund to the system:refunds ledger account', function () {
    $customer = Customer::create(['name' => 'Refund Router', 'phone' => '9600000001']);
    $tour = Tour::create([
        'title' => 'Refund Tour', 'slug' => 'refund-tour-'.uniqid(),
        'duration_days' => 1, 'duration_nights' => 0,
        'price_per_person' => 1000, 'child_price' => 500,
        'available_from' => now(), 'available_to' => now()->addMonth(), 'is_active' => true,
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addWeek()->toDateString(),
        'return_date' => now()->addWeek()->toDateString(),
        'total_seats' => 10, 'reserved_seats' => 0, 'booked_seats' => 2, 'status' => 'open',
    ]);
    $booking = TourBooking::create([
        'customer_id' => $customer->id, 'tour_id' => $tour->id, 'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 2, 'number_of_children' => 0, 'travel_date' => $schedule->departure_date,
        'customer_name' => $customer->name, 'customer_phone' => $customer->phone,
        'price_per_adult' => 1000, 'price_per_child' => 500, 'subtotal' => 2000, 'total_price' => 2000,
        'status' => 'confirmed', 'payment_status' => 'paid', 'payment_method' => 'wallet',
    ]);

    // >24h out and not yet active → no cancellation fee → full refund.
    $refund = app(BookingCancellationService::class)->cancel($booking, BookingStatusService::TOUR);

    expect($refund)->not->toBeNull();

    $refundsAccount = LedgerAccount::where('code', 'system:refunds')->firstOrFail();

    $debitInRefunds = (int) LedgerEntry::where('ledger_account_id', $refundsAccount->id)
        ->where('direction', 'debit')
        ->where('reference_type', 'tour_refund')
        ->sum('amount_minor');

    expect($debitInRefunds)->toBe(Money::toMinor(2000.0))
        ->and($booking->fresh()->payment_status)->toBe('refunded')
        // ledger stays balanced
        ->and((int) LedgerEntry::where('direction', 'debit')->sum('amount_minor'))
        ->toBe((int) LedgerEntry::where('direction', 'credit')->sum('amount_minor'));
});

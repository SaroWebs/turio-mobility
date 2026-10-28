<?php

use App\Models\BookingAuditLog;
use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\RideBooking;
use App\Models\Role;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourSchedule;
use App\Models\User;

function adminUserForPaymentConfirmation(): User
{
    $admin = User::create([
        'name' => 'Payment Admin',
        'email' => 'payment-admin-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    return $admin;
}

it('lets admin confirm cash payment for a ride booking', function () {
    $admin = adminUserForPaymentConfirmation();
    $customer = Customer::create(['name' => 'Cash Ride Customer', 'phone' => '9200000001']);
    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Station',
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 12,
        'total_fare' => 450,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/ride-bookings/{$ride->id}/confirm-payment", [
            'payment_method' => 'cash',
            'note' => 'Cash collected at counter',
        ])
        ->assertOk()
        ->assertJsonPath('booking.payment_status', 'paid')
        ->assertJsonPath('booking.payment_method', 'cash');

    $this->assertDatabaseHas('booking_audit_logs', [
        'auditable_type' => RideBooking::class,
        'auditable_id' => $ride->id,
        'admin_id' => $admin->id,
        'action' => 'payment_confirmed',
    ]);
});

it('lets admin confirm non-wallet tour payment and syncs seat inventory', function () {
    $admin = adminUserForPaymentConfirmation();
    $customer = Customer::create(['name' => 'UPI Tour Customer', 'phone' => '9200000002']);
    $tour = Tour::create([
        'title' => 'Payment Tour',
        'slug' => 'payment-tour',
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
        'reserved_seats' => 2,
        'booked_seats' => 0,
        'status' => 'open',
    ]);
    $booking = TourBooking::create([
        'customer_id' => $customer->id,
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'number_of_adults' => 2,
        'number_of_children' => 0,
        'travel_date' => $schedule->departure_date,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'price_per_adult' => 1000,
        'price_per_child' => 500,
        'subtotal' => 2000,
        'total_price' => 2000,
        'status' => 'pending',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/tour-bookings/{$booking->id}/confirm-payment", [
            'payment_method' => 'upi',
            'payment_reference' => 'upi-ref-123',
            'note' => 'UPI confirmed by admin',
        ])
        ->assertOk()
        ->assertJsonPath('booking.status', 'confirmed')
        ->assertJsonPath('booking.payment_status', 'paid')
        ->assertJsonPath('booking.payment_method', 'upi');

    $this->assertDatabaseHas('tour_schedules', [
        'id' => $schedule->id,
        'reserved_seats' => 0,
        'booked_seats' => 2,
    ]);

    $audit = BookingAuditLog::where('auditable_type', TourBooking::class)
        ->where('auditable_id', $booking->id)
        ->where('action', 'payment_confirmed')
        ->firstOrFail();

    expect($audit->after['payment_reference'])->toBe('upi-ref-123');
    $this->actingAs($admin)->postJson("/admin/tour-bookings/{$booking->id}/confirm-payment", [
        'payment_method' => 'upi', 'payment_reference' => 'upi-ref-123',
    ])->assertOk();
    expect($booking->payments()->count())->toBe(1);
    expect($booking->payments()->first()->provider)->toBe('manual');
    expect(\App\Models\LedgerEntry::count())->toBe(2);
    expect((int) $schedule->fresh()->booked_seats)->toBe(2);
    $this->actingAs($admin)->postJson("/admin/tour-bookings/{$booking->id}/update-status", ['payment_status' => 'refunded'])->assertUnprocessable();
    expect($booking->fresh()->payment_status)->toBe('paid');
});

it('rejects admin payment confirmation for refunded bookings', function () {
    $admin = adminUserForPaymentConfirmation();
    $customer = Customer::create(['name' => 'Refunded Rental Customer', 'phone' => '9200000003']);
    $category = CarCategory::create([
        'name' => 'Refunded Category',
        'slug' => 'refunded-category',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 1500,
    ]);
    $rental = CarRental::create([
        'customer_id' => $customer->id,
        'car_category_id' => $category->id,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'start_date' => now()->addDays(2)->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
        'number_of_days' => 2,
        'pickup_location' => 'Hotel',
        'base_price' => 3000,
        'total_price' => 3000,
        'status' => 'cancelled',
        'payment_status' => 'refunded',
        'payment_method' => 'wallet',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/car-rentals/{$rental->id}/confirm-payment", [
            'payment_method' => 'cash',
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Refunded bookings cannot be marked as paid.');
});

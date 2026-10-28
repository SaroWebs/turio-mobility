<?php

use App\Models\Customer;
use App\Models\OutboxMessage;
use App\Models\Role;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourCategory;
use App\Models\TourInquiry;
use App\Models\TourSchedule;
use App\Models\User;
use App\Services\BookingCancellationService;
use Laravel\Sanctum\Sanctum;

function waitlistAdminUser(): User
{
    $admin = User::create([
        'name' => 'Waitlist Admin',
        'email' => 'admin-waitlist-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    return $admin;
}

it('allows customer to join waitlist for a sold-out schedule and receives outbox confirmation', function () {
    $customer = Customer::create(['name' => 'Waiting Customer', 'phone' => '9876543210', 'email' => 'wait@example.com']);
    $category = TourCategory::create(['name' => 'Wildlife', 'slug' => 'wildlife', 'is_active' => true]);
    $tour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Rhino Trek',
        'slug' => 'rhino-trek',
        'price_per_person' => 1500,
        'is_active' => true,
        'start_location' => 'Kaziranga',
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addDays(10)->toDateString(),
        'departure_time' => '06:00:00',
        'return_date' => now()->addDays(12)->toDateString(),
        'total_seats' => 2,
        'booked_seats' => 2,
        'reserved_seats' => 0,
        'status' => 'open',
    ]);

    Sanctum::actingAs($customer);

    $response = $this->postJson('/api/customer-app/tours/inquiry', [
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'inquiry_type' => 'sold_out_waitlist',
        'number_of_guests' => 2,
        'special_requests' => 'Looking for 2 morning seats.',
    ])->assertCreated();

    $inquiryId = $response->json('data.id');
    expect($inquiryId)->not->toBeNull()
        ->and(TourInquiry::find($inquiryId)->status)->toBe('pending')
        ->and(TourInquiry::find($inquiryId)->inquiry_type)->toBe('sold_out_waitlist');

    // Confirmatory outbox message was enqueued
    $confirmation = OutboxMessage::where('dedup_key', 'like', "tour:waitlist:joined:{$inquiryId}:%")->first();
    expect($confirmation)->not->toBeNull()
        ->and($confirmation->recipient)->toBe('9876543210')
        ->and($confirmation->body)->toContain('Rhino Trek');
});

it('rejects duplicate pending waitlist requests for the same customer and departure', function () {
    $customer = Customer::create(['name' => 'Dup Customer', 'phone' => '9876543211']);
    $category = TourCategory::create(['name' => 'Wildlife', 'slug' => 'wildlife-dup', 'is_active' => true]);
    $tour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Tiger Trail',
        'slug' => 'tiger-trail',
        'price_per_person' => 2000,
        'is_active' => true,
        'start_location' => 'Manas',
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addDays(7)->toDateString(),
        'departure_time' => '07:00:00',
        'return_date' => now()->addDays(8)->toDateString(),
        'total_seats' => 4,
        'booked_seats' => 4,
        'status' => 'open',
    ]);

    Sanctum::actingAs($customer);

    $payload = [
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'inquiry_type' => 'sold_out_waitlist',
        'number_of_guests' => 1,
    ];

    $this->postJson('/api/customer-app/tours/inquiry', $payload)->assertCreated();
    $this->postJson('/api/customer-app/tours/inquiry', $payload)->assertStatus(422)
        ->assertJsonValidationErrors(['tour_schedule_id']);
});

it('allows customer to submit a private tour inquiry with custom date and guest count', function () {
    $customer = Customer::create(['name' => 'VIP Customer', 'phone' => '9876543212', 'email' => 'vip@example.com']);
    $category = TourCategory::create(['name' => 'Luxury', 'slug' => 'luxury', 'is_active' => true]);
    $tour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Private Tea Estate Haven',
        'slug' => 'private-tea-estate',
        'price_per_person' => 5000,
        'is_active' => true,
        'start_location' => 'Jorhat',
    ]);

    Sanctum::actingAs($customer);

    $response = $this->postJson('/api/customer-app/tours/inquiry', [
        'tour_id' => $tour->id,
        'inquiry_type' => 'private_tour_request',
        'desired_date' => now()->addMonths(2)->format('Y-m-d'),
        'number_of_guests' => 6,
        'special_requests' => 'Private chef requested.',
    ])->assertCreated();

    $inquiryId = $response->json('data.id');
    $inquiry = TourInquiry::find($inquiryId);
    expect($inquiry->inquiry_type)->toBe('private_tour_request')
        ->and($inquiry->number_of_guests)->toBe(6)
        ->and($inquiry->tour_schedule_id)->toBeNull();

    $outbox = OutboxMessage::where('dedup_key', 'like', "tour:private:request:{$inquiryId}:%")->first();
    expect($outbox)->not->toBeNull()
        ->and($outbox->recipient)->toBe('9876543212');
});

it('automatically notifies waitlisted customers when seats become available upon booking cancellation', function () {
    $waitCustomer = Customer::create(['name' => 'Hopeful Customer', 'phone' => '9876543213', 'email' => 'hope@example.com']);
    $bookedCustomer = Customer::create(['name' => 'Original Customer', 'phone' => '9876543214']);

    $category = TourCategory::create(['name' => 'Hills', 'slug' => 'hills', 'is_active' => true]);
    $tour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Mawlynnong Living Root',
        'slug' => 'mawlynnong-living-root',
        'price_per_person' => 1200,
        'is_active' => true,
        'start_location' => 'Shillong',
    ]);
    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addDays(5)->toDateString(),
        'departure_time' => '08:00:00',
        'return_date' => now()->addDays(6)->toDateString(),
        'total_seats' => 2,
        'booked_seats' => 2,
        'reserved_seats' => 0,
        'status' => 'open',
    ]);

    // Create existing booking occupying all 2 seats
    $booking = TourBooking::create([
        'customer_id' => $bookedCustomer->id,
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'travel_date' => $schedule->departure_date,
        'number_of_adults' => 2,
        'customer_name' => $bookedCustomer->name,
        'customer_phone' => $bookedCustomer->phone,
        'price_per_adult' => 1200,
        'total_price' => 2400,
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'payment_method' => 'cash',
    ]);

    // Waitlisted customer joins waitlist for 2 seats
    $inquiry = TourInquiry::create([
        'customer_id' => $waitCustomer->id,
        'tour_id' => $tour->id,
        'tour_schedule_id' => $schedule->id,
        'inquiry_type' => 'sold_out_waitlist',
        'status' => 'pending',
        'number_of_guests' => 2,
        'customer_name' => $waitCustomer->name,
        'customer_phone' => $waitCustomer->phone,
        'customer_email' => $waitCustomer->email,
    ]);

    expect($inquiry->notified_at)->toBeNull();

    // Cancel booking: releases 2 booked seats
    app(BookingCancellationService::class)->cancel($booking, 'tour', 'Customer personal emergency', null, 'customer');

    // Verify schedule has released seats
    expect($schedule->fresh()->booked_seats)->toBe(0)
        ->and($schedule->fresh()->getAvailableSeats())->toBe(2);

    // Verify waitlisted customer was automatically alerted in outbox
    $alertMessage = OutboxMessage::where('dedup_key', 'like', "tour:waitlist:capacity_alert:{$inquiry->id}:{$schedule->id}:%")->first();
    expect($alertMessage)->not->toBeNull()
        ->and($alertMessage->recipient)->toBe('9876543213')
        ->and($alertMessage->body)->toContain('Seats have opened up')
        ->and($inquiry->fresh()->notified_at)->not->toBeNull();
});

it('allows admin to list, update, and notify inquiry customers', function () {
    $admin = waitlistAdminUser();
    $customer = Customer::create(['name' => 'Alice Inquiry', 'phone' => '9876543215', 'email' => 'alice@example.com']);
    $category = TourCategory::create(['name' => 'Adventure', 'slug' => 'adventure-inquiry', 'is_active' => true]);
    $tour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Brahmaputra Cruise',
        'slug' => 'brahmaputra-cruise',
        'price_per_person' => 3000,
        'is_active' => true,
        'start_location' => 'Guwahati',
    ]);

    $inquiry = TourInquiry::create([
        'customer_id' => $customer->id,
        'tour_id' => $tour->id,
        'inquiry_type' => 'private_tour_request',
        'status' => 'pending',
        'number_of_guests' => 8,
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'customer_email' => $customer->email,
    ]);

    $this->actingAs($admin);

    // Admin lists inquiries
    $list = $this->getJson('/admin/tour-inquiries')->assertOk()->json('data');
    expect(collect($list)->pluck('id')->all())->toContain($inquiry->id);

    // Admin updates status with operator notes
    $this->patchJson("/admin/tour-inquiries/{$inquiry->id}", [
        'status' => 'contacted',
        'operator_notes' => 'Spoke with customer; customized boat package offered.',
    ])->assertOk();

    expect($inquiry->fresh()->status)->toBe('contacted')
        ->and($inquiry->fresh()->operator_notes)->toContain('customized boat package');

    // Admin sends notification to customer
    $this->postJson("/admin/tour-inquiries/{$inquiry->id}/notify", [
        'message' => 'Your customized cruise proposal is ready for review.',
    ])->assertOk();

    $customOutbox = OutboxMessage::where('recipient', '9876543215')
        ->where('body', 'like', '%customized cruise proposal%')
        ->first();
    expect($customOutbox)->not->toBeNull();
});

it('allows customer to view and cancel their own pending inquiries', function () {
    $customer1 = Customer::create(['name' => 'Customer One', 'phone' => '9876543216']);
    $customer2 = Customer::create(['name' => 'Customer Two', 'phone' => '9876543217']);

    $category = TourCategory::create(['name' => 'General', 'slug' => 'general-inquiry', 'is_active' => true]);
    $tour = Tour::create([
        'tour_category_id' => $category->id,
        'title' => 'Kamakhya Temple Walk',
        'slug' => 'kamakhya-walk',
        'price_per_person' => 500,
        'is_active' => true,
        'start_location' => 'Guwahati',
    ]);

    $inquiry = TourInquiry::create([
        'customer_id' => $customer1->id,
        'tour_id' => $tour->id,
        'inquiry_type' => 'sold_out_waitlist',
        'status' => 'pending',
        'number_of_guests' => 1,
        'customer_name' => $customer1->name,
        'customer_phone' => $customer1->phone,
    ]);

    // Customer 2 cannot cancel customer 1's inquiry
    Sanctum::actingAs($customer2);
    $this->deleteJson("/api/customer-app/tour-inquiries/{$inquiry->id}")->assertForbidden();

    // Customer 1 views inquiries
    Sanctum::actingAs($customer1);
    $myInquiries = $this->getJson('/api/customer-app/tour-inquiries')->assertOk()->json('data');
    expect(collect($myInquiries)->pluck('id')->all())->toBe([$inquiry->id]);

    // Customer 1 cancels their inquiry
    $this->deleteJson("/api/customer-app/tour-inquiries/{$inquiry->id}")->assertOk();
    expect($inquiry->fresh()->status)->toBe('cancelled');
});

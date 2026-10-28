<?php

use App\Models\Customer;
use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\RideBookingReview;
use App\Models\Role;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function ratingsAdmin(): User
{
    $admin = User::create([
        'name' => 'Ratings Admin',
        'email' => 'ratings-admin-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    return $admin;
}

it('shows driver rating averages in the list and customer feedback in details', function () {
    $customer = Customer::create(['name' => 'Happy Customer', 'phone' => '9000000991']);
    $driver = Driver::create([
        'name' => 'Rated Driver',
        'phone' => '8000000991',
        'status' => 'active',
    ]);
    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Central Station',
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 12,
        'total_fare' => 450,
        'status' => 'completed',
        'payment_status' => 'paid',
        'payment_method' => 'cash',
    ]);

    RideBookingReview::create([
        'ride_booking_id' => $ride->id,
        'customer_id' => $customer->id,
        'driver_id' => $driver->id,
        'driver_rating' => 4,
        'review' => 'Safe, polite, and right on time.',
    ]);

    $admin = ratingsAdmin();

    $this->actingAs($admin)->get('/admin/drivers')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/Drivers')
            ->where('drivers.data.0.id', $driver->id)
            ->where('drivers.data.0.average_rating', 4)
            ->where('drivers.data.0.ratings_count', 1));

    $this->actingAs($admin)->get("/admin/drivers/{$driver->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/Drivers/Show')
            ->where('stats.average_rating', 4)
            ->where('stats.ratings_count', 1)
            ->where('reviews.0.customer_name', 'Happy Customer')
            ->where('reviews.0.feedback', 'Safe, polite, and right on time.')
            ->where('reviews.0.service', 'Ride'));
});

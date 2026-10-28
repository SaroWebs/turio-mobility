<?php

use App\Models\Role;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function unifiedBookingsAdmin(): User
{
    $admin = User::create([
        'name' => 'Bookings Admin',
        'email' => 'bookings-admin-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    return $admin;
}

it('shows ride, tour, and car rental bookings in one tabbed admin page', function () {
    $this->actingAs(unifiedBookingsAdmin())
        ->get('/admin/bookings')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/Bookings')
            ->where('filters.tab', 'ride')
            ->has('rides.data')
            ->has('tours.data')
            ->has('rentals.data'));
});

it('redirects old booking list pages into the matching unified bookings tab', function (string $path, string $tab) {
    $this->actingAs(unifiedBookingsAdmin())
        ->get($path.'?status=pending&search=abc')
        ->assertRedirect(route('admin.bookings', [
            'status' => 'pending',
            'search' => 'abc',
            'tab' => $tab,
        ]));
})->with([
    ['/admin/ride-bookings', 'ride'],
    ['/admin/tour-bookings', 'tour'],
    ['/admin/car-rentals', 'rental'],
]);

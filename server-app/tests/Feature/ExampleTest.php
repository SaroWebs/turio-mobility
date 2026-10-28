<?php

use App\Models\Role;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('public welcome page exposes no operational data', function () {
    $response = $this->get('/');

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('welcome')
            ->missing('landing'));
});

test('authenticated admin moves from welcome to the dashboard', function () {
    $admin = User::create([
        'name' => 'Welcome Admin',
        'email' => 'welcome-admin-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $this->actingAs($admin)
        ->get('/')
        ->assertRedirect(route('admin.dashboard'));
});

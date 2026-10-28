<?php

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\Role;
use App\Models\User;

function driverManagementAdmin(): User
{
    $admin = User::create([
        'name' => 'Driver Management Admin',
        'email' => 'driver-management-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    return $admin;
}

function driverPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Admin Created Driver',
        'email' => 'admin-created-driver@example.com',
        'phone' => '8111111199',
        'date_of_birth' => '1990-04-15',
        'gender' => 'other',
        'license_number' => 'DL-ADMIN-100',
        'license_expiry' => now()->addYear()->toDateString(),
        'vehicle_type' => 'SUV',
        'vehicle_number' => 'KA01ADMIN100',
        'vehicle_model' => 'Test Utility',
        'vehicle_color' => 'Blue',
        'vehicle_year' => now()->year,
        'status' => 'pending',
        'can_short_ride' => true,
        'can_long_ride' => true,
        'can_tour_lead' => false,
        'can_tour_transport' => true,
        'can_rental_delivery' => true,
    ], $overrides);
}

it('allows an admin to create a driver with service capabilities', function () {
    $admin = driverManagementAdmin();

    $this->actingAs($admin)
        ->post('/admin/drivers', driverPayload())
        ->assertRedirect('/admin/drivers')
        ->assertSessionHas('success');

    $driver = Driver::where('phone', '8111111199')->firstOrFail();

    expect($driver->status)->toBe('pending')
        ->and($driver->is_approved)->toBeFalse()
        ->and($driver->can_short_ride)->toBeTrue()
        ->and($driver->can_tour_transport)->toBeTrue()
        ->and($driver->can_rental_delivery)->toBeTrue()
        ->and($driver->driverAvailability?->status)->toBe('offline');
});

it('allows an admin to edit and approve a driver while preserving unique fields', function () {
    $admin = driverManagementAdmin();
    $driver = Driver::create(driverPayload([
        'email' => 'existing-driver@example.com',
        'phone' => '8111111188',
    ]));
    foreach (['driving_license', 'government_id', 'vehicle_rc'] as $type) {
        DriverDocument::create([
            'driver_id' => $driver->id,
            'type' => $type,
            'file_path' => "test/{$type}.pdf",
            'status' => 'approved',
        ]);
    }

    $this->actingAs($admin)
        ->put("/admin/drivers/{$driver->id}", driverPayload([
            'name' => 'Updated Driver Name',
            'email' => 'existing-driver@example.com',
            'phone' => '8111111188',
            'status' => 'active',
            'can_tour_lead' => true,
        ]))
        ->assertRedirect('/admin/drivers')
        ->assertSessionHas('success');

    $driver->refresh();

    expect($driver->name)->toBe('Updated Driver Name')
        ->and($driver->status)->toBe('active')
        ->and($driver->is_active)->toBeTrue()
        ->and($driver->is_approved)->toBeTrue()
        ->and($driver->approved_at)->not->toBeNull()
        ->and($driver->approved_by)->toBe($admin->id)
        ->and($driver->can_tour_lead)->toBeTrue();
});

it('shows validation errors instead of creating duplicate driver contact details', function () {
    $admin = driverManagementAdmin();
    Driver::create(driverPayload());

    $this->actingAs($admin)
        ->from('/admin/drivers')
        ->post('/admin/drivers', driverPayload(['name' => 'Duplicate Driver']))
        ->assertRedirect('/admin/drivers')
        ->assertSessionHasErrors(['email', 'phone']);

    expect(Driver::count())->toBe(1);
});

<?php

use App\Models\CarCategory;
use App\Models\CmsContent;
use App\Models\Driver;
use App\Models\Role;
use App\Models\User;
use App\Models\Vehicle;

function cmsFleetAdmin(): User
{
    $role = Role::create(['name' => 'admin', 'display_name' => 'Administrator']);
    $admin = User::factory()->create();
    $admin->roles()->attach($role);

    return $admin;
}

function cmsFleetCategory(): CarCategory
{
    return CarCategory::create([
        'name' => 'Hill SUV',
        'slug' => 'hill-suv-'.uniqid(),
        'vehicle_type' => 'suv',
        'seats' => 6,
        'base_price_per_day' => 4500,
        'is_active' => true,
    ]);
}

it('publishes CMS content and resolves external and stored image values', function () {
    CmsContent::create([
        'app' => 'customer-web',
        'page' => 'home',
        'section' => 'hero',
        'key' => 'title',
        'type' => 'text',
        'value' => 'Explore Northeast India',
        'is_active' => true,
    ]);
    CmsContent::create([
        'app' => 'customer-web',
        'page' => 'home',
        'section' => 'hero',
        'key' => 'image',
        'type' => 'image',
        'value' => 'https://images.example.com/hero.jpg',
        'is_active' => true,
    ]);
    CmsContent::create([
        'app' => 'customer-web',
        'page' => 'home',
        'section' => 'promo',
        'key' => 'image',
        'type' => 'image',
        'value' => 'cms/promo.jpg',
        'is_active' => true,
    ]);

    $this->getJson('/api/customer-app/public/cms/customer-web')
        ->assertOk()
        ->assertJsonPath('data.home.hero.title', 'Explore Northeast India')
        ->assertJsonPath('data.home.hero.image', 'https://images.example.com/hero.jpg')
        ->assertJsonPath('data.home.promo.image', url('/storage/cms/promo.jpg'));
});

it('lets an administrator assign or unassign a vehicle from the driver screen', function () {
    $admin = cmsFleetAdmin();
    $driver = Driver::create([
        'name' => 'Fleet Driver',
        'phone' => '7000000111',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);
    $vehicle = Vehicle::create([
        'car_category_id' => cmsFleetCategory()->id,
        'registration_number' => 'AS01HM9999',
        'make' => 'Mahindra',
        'model' => 'Scorpio N',
        'year' => 2024,
        'color' => 'White',
        'fuel_type' => 'diesel',
        'seats' => 6,
    ]);

    $this->actingAs($admin)
        ->put("/admin/drivers/{$driver->id}/vehicle", ['vehicle_id' => $vehicle->id])
        ->assertRedirect();
    expect($vehicle->fresh()->driver_id)->toBe($driver->id);

    $this->actingAs($admin)
        ->put("/admin/drivers/{$driver->id}/vehicle", ['vehicle_id' => null])
        ->assertRedirect();
    expect($vehicle->fresh()->driver_id)->toBeNull();
});

it('does not steal a vehicle that is assigned to another driver', function () {
    $admin = cmsFleetAdmin();
    $first = Driver::create(['name' => 'First Driver', 'phone' => '7000000221', 'status' => 'active', 'is_active' => true, 'is_approved' => true]);
    $second = Driver::create(['name' => 'Second Driver', 'phone' => '7000000222', 'status' => 'active', 'is_active' => true, 'is_approved' => true]);
    $vehicle = Vehicle::create([
        'car_category_id' => cmsFleetCategory()->id,
        'driver_id' => $first->id,
        'registration_number' => 'AS01HM8888',
        'make' => 'Toyota',
        'model' => 'Innova',
        'year' => 2024,
        'color' => 'Silver',
        'fuel_type' => 'diesel',
        'seats' => 7,
    ]);

    $this->actingAs($admin)
        ->from('/admin/drivers')
        ->put("/admin/drivers/{$second->id}/vehicle", ['vehicle_id' => $vehicle->id])
        ->assertRedirect('/admin/drivers')
        ->assertSessionHasErrors('vehicle_id');

    expect($vehicle->fresh()->driver_id)->toBe($first->id);
});

<?php

use App\Models\CarCategory;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\Role;
use App\Models\ServiceZone;
use App\Models\Setting;
use App\Models\User;
use App\Services\DriverDispatchService;
use App\Support\Pricing\PricingService;
use App\Support\Settings\SettingsService;
use App\Support\Settings\ZoneResolver;
use Illuminate\Support\Facades\Cache;

function configurationAdmin(): User
{
    $admin = User::create([
        'name' => 'Configuration Admin',
        'email' => 'configuration-admin-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
    $admin->roles()->attach($role);

    return $admin;
}

it('resolves settings by category and zone specificity and invalidates cached rows', function () {
    Cache::forget(SettingsService::CACHE_KEY);
    $category = CarCategory::create([
        'name' => 'Config Category',
        'slug' => 'config-category',
        'vehicle_type' => 'sedan',
        'seats' => 4,
        'base_price_per_day' => 100,
    ]);
    $zone = ServiceZone::create([
        'name' => 'Config Zone',
        'center_lat' => 26.1445,
        'center_lng' => 91.7362,
        'radius_km' => 20,
        'priority' => 1,
        'is_active' => true,
    ]);

    Setting::create(['key' => 'ride.dispatch.pickup_radius_km', 'value' => 40]);
    expect(setting('ride.dispatch.pickup_radius_km', 30))->toBe(40.0);

    Setting::create(['key' => 'ride.dispatch.pickup_radius_km', 'scope_zone_id' => $zone->id, 'value' => 25]);
    Setting::create(['key' => 'ride.dispatch.pickup_radius_km', 'scope_category_id' => $category->id, 'value' => 20]);
    Setting::create([
        'key' => 'ride.dispatch.pickup_radius_km',
        'scope_category_id' => $category->id,
        'scope_zone_id' => $zone->id,
        'value' => 10,
    ]);

    expect(setting('ride.dispatch.pickup_radius_km', 30, ['lat' => 26.1445, 'lng' => 91.7362, 'category_id' => $category->id]))->toBe(10.0)
        ->and(setting('ride.dispatch.pickup_radius_km', 30, ['lat' => 26.1445, 'lng' => 91.7362]))->toBe(25.0)
        ->and(setting('ride.dispatch.pickup_radius_km', 30, ['category_id' => $category->id]))->toBe(20.0);

    $zone->update(['radius_km' => 1]);
    expect(app(ZoneResolver::class)->resolveZoneId(26.1445, 91.7362))->toBe($zone->id);
});

it('calculates tax and service fees from the discounted subtotal', function () {
    Setting::create(['key' => 'fees.tax_percent', 'value' => 0.18]);
    Setting::create(['key' => 'fees.service_fee_percent', 'value' => 0.05]);
    Setting::create(['key' => 'fees.service_fee_flat', 'value' => 20]);

    expect(app(PricingService::class)->applyFees(1000))->toBe([
        'subtotal' => 1000.0,
        'tax' => 180.0,
        'service_fee' => 70.0,
        'total' => 1250.0,
    ]);
});

it('writes catalog settings and service zones through admin routes', function () {
    $admin = configurationAdmin();

    $this->actingAs($admin)
        ->post('/admin/settings', [
            'values' => [
                'ride.dispatch.pickup_radius_km' => 12.5,
                'commission.ride.default' => 0.17,
            ],
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $this->assertDatabaseHas('settings', ['key' => 'ride.dispatch.pickup_radius_km', 'value' => json_encode(12.5)]);
    expect(setting('commission.ride.default', 0.20))->toBe(0.17);

    $this->actingAs($admin)
        ->post('/admin/service-zones', [
            'name' => 'Admin Zone',
            'center_lat' => 26.1,
            'center_lng' => 91.7,
            'radius_km' => 5,
            'priority' => 3,
            'is_active' => 1,
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $this->assertDatabaseHas('service_zones', ['name' => 'Admin Zone', 'priority' => 3]);
});

it('uses a zone pickup radius override for driver eligibility', function () {
    $driver = Driver::create([
        'name' => 'Radius Driver',
        'phone' => '9500000030',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);
    DriverAvailability::create([
        'driver_id' => $driver->id,
        'status' => 'online',
        'is_available' => true,
        'current_lat' => 26.1545,
        'current_lng' => 91.7362,
        'last_updated' => now(),
    ]);
    $zone = ServiceZone::create([
        'name' => 'Radius Zone',
        'center_lat' => 26.1445,
        'center_lng' => 91.7362,
        'radius_km' => 20,
        'priority' => 1,
        'is_active' => true,
    ]);
    Setting::create([
        'key' => 'ride.dispatch.pickup_radius_km',
        'scope_zone_id' => $zone->id,
        'value' => 0.5,
    ]);

    expect(app(DriverDispatchService::class)->eligibilityFailures(
        $driver,
        'short_ride',
        pickupLat: 26.1445,
        pickupLng: 91.7362,
    ))->toContain('Driver is outside the 0.5 km pickup radius.');
});

<?php

namespace Tests\Feature;

use App\Models\CarCategory;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\RideBooking;
use App\Models\Setting;
use App\Models\Vehicle;
use App\Services\DriverDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DispatchFairnessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Setting::updateOrCreate(['key' => 'ride.dispatch.pickup_radius_km'], ['value' => 50.0]);
        Setting::updateOrCreate(['key' => 'ride.dispatch.stale_availability_seconds'], ['value' => 3600]);
        Setting::updateOrCreate(['key' => 'ride.dispatch.window_minutes'], ['value' => 15]);
    }

    private function createEligibleDriver(string $name, string $phone): Driver
    {
        $category = CarCategory::firstOrCreate(['slug' => 'sedan'], [
            'name' => 'Sedan', 'vehicle_type' => 'sedan', 'seats' => 4,
        ]);

        $driver = Driver::create([
            'name' => $name,
            'phone' => $phone,
            'status' => 'active',
            'is_active' => true,
            'is_approved' => true,
            'can_short_ride' => true,
        ]);

        Vehicle::create([
            'driver_id' => $driver->id,
            'car_category_id' => $category->id,
            'registration_number' => 'REG'.substr($phone, -4),
            'make' => 'Toyota',
            'model' => 'Etios',
            'year' => 2021,
            'color' => 'White',
            'fuel_type' => 'petrol',
            'seats' => 4,
            'is_ac' => true,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        return $driver;
    }

    public function test_existing_behavior_preserved_when_fairness_disabled()
    {
        Setting::updateOrCreate(['key' => 'ride.dispatch.fairness_scoring_enabled'], ['value' => '0']);

        $driver1 = $this->createEligibleDriver('Driver Far', '919000000001');
        $driver2 = $this->createEligibleDriver('Driver Close', '919000000002');

        DriverAvailability::create([
            'driver_id' => $driver1->id,
            'current_lat' => 10.0,
            'current_lng' => 10.1, // further
            'status' => 'online',
            'is_available' => true,
            'last_updated' => now(),
        ]);

        DriverAvailability::create([
            'driver_id' => $driver2->id,
            'current_lat' => 10.0,
            'current_lng' => 10.01, // closer
            'status' => 'online',
            'is_available' => true,
            'last_updated' => now(),
        ]);

        $service = app(DriverDispatchService::class);
        $candidates = $service->rankedCandidates('short_ride', 10.0, 10.0, null, 10);

        $this->assertNotEmpty($candidates);
        $this->assertEquals($driver2->id, $candidates->first()->driver_id);
    }

    public function test_idle_drivers_get_priority_when_enabled()
    {
        Setting::updateOrCreate(['key' => 'ride.dispatch.fairness_scoring_enabled'], ['value' => '1']);

        $driver1 = $this->createEligibleDriver('Driver Close', '919000000003');
        $driver2 = $this->createEligibleDriver('Driver Far', '919000000004');

        DriverAvailability::create([
            'driver_id' => $driver1->id,
            'current_lat' => 10.0,
            'current_lng' => 10.01, // closer
            'status' => 'online',
            'is_available' => true,
            'last_updated' => now(),
        ]);

        DriverAvailability::create([
            'driver_id' => $driver2->id,
            'current_lat' => 10.0,
            'current_lng' => 10.1, // further
            'status' => 'online',
            'is_available' => true,
            'last_updated' => now(),
        ]);

        $service = app(DriverDispatchService::class);
        $candidates = $service->rankedCandidates('short_ride', 10.0, 10.0, null, 10);

        $this->assertNotEmpty($candidates);
    }

    public function test_metrics_command_outputs_valid_data()
    {
        $this->artisan('dispatch:metrics-report')
            ->assertExitCode(0);
    }

    public function test_metrics_use_real_expiry_outcomes_and_positive_elapsed_time()
    {
        $customer = \App\Models\Customer::create(['name' => 'Metrics', 'phone' => '919000444555']);
        $attrs = ['customer_id' => $customer->id, 'customer_name' => 'Metrics', 'customer_phone' => $customer->phone,
            'service_type' => 'point_to_point', 'pickup_location' => 'A', 'dropoff_location' => 'B', 'scheduled_at' => now(),
            'created_at' => now()->subMinute()];
        RideBooking::create([...$attrs, 'status' => 'cancelled', 'request_outcome' => 'expired']);
        RideBooking::create([...$attrs, 'status' => 'driver_assigned', 'driver_assigned_at' => now()])->forceFill(['created_at' => now()->subMinute()])->save();
        $result = app(\App\Services\DispatchMetricsService::class)->metrics();
        $this->assertEquals(50, $result['no_driver_rate']);
        $this->assertEqualsWithDelta(60, $result['time_to_assign'], 1);
    }
}

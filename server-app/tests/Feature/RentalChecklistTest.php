<?php

namespace Tests\Feature;

use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\RentalChecklist;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RentalChecklistTest extends TestCase
{
    use RefreshDatabase;

    private function createDriver(): Driver
    {
        return Driver::create([
            'name' => 'Rental Driver',
            'phone' => '9888111001',
            'email' => 'driver@example.com',
            'status' => 'active',
            'is_active' => true,
            'is_approved' => true,
            'can_rental_delivery' => true,
        ]);
    }

    private function createRental(Driver $driver, array $attrs = []): CarRental
    {
        $customer = Customer::firstOrCreate(['phone' => '9900112233'], ['name' => 'Alice Customer', 'email' => 'alice@example.com']);
        $category = CarCategory::firstOrCreate(['slug' => 'sedan'], [
            'name' => 'Sedan',
            'vehicle_type' => 'sedan',
            'seats' => 4,
            'base_price_per_day' => 1000,
        ]);

        $vehicle = \App\Models\Vehicle::create([
            'driver_id' => $driver->id,
            'car_category_id' => $category->id,
            'registration_number' => 'KA01EXEC01',
            'make' => 'Honda',
            'model' => 'City',
            'year' => 2023,
            'color' => 'White',
            'fuel_type' => 'petrol',
            'seats' => 4,
            'is_ac' => true,
            'is_active' => true,
            'approval_status' => 'approved',
            'is_available_for_rent' => true,
        ]);

        return CarRental::create(array_merge([
            'customer_id' => $customer->id,
            'car_category_id' => $category->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'customer_name' => 'Alice Customer',
            'customer_email' => 'alice@example.com',
            'customer_phone' => '9900112233',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(2)->toDateString(),
            'number_of_days' => 2,
            'pickup_location' => 'Bangalore',
            'base_price' => 2000,
            'total_price' => 2000,
            'status' => 'driver_assigned',
            'payment_status' => 'paid',
            'payment_method' => 'card',
        ], $attrs));
    }

    public function test_driver_can_submit_handover_checklist()
    {
        $driver = $this->createDriver();
        $rental = $this->createRental($driver);

        $response = $this->actingAs($driver, 'sanctum')->postJson("/api/driver-app/car-rentals/{$rental->id}/checklist", [
            'type' => 'handover',
            'odometer_reading' => 12345,
            'fuel_level_percent' => 100,
            'cleanliness' => 'clean',
            'damage_detected' => false,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('rental_checklists', [
            'car_rental_id' => $rental->id,
            'type' => 'handover',
            'completed_by_type' => 'driver',
            'completed_by_id' => $driver->id,
            'odometer_reading' => 12345,
        ]);
    }

    public function test_driver_can_submit_return_checklist()
    {
        $driver = $this->createDriver();
        $rental = $this->createRental($driver);

        $response = $this->actingAs($driver, 'sanctum')->postJson("/api/driver-app/car-rentals/{$rental->id}/checklist", [
            'type' => 'return',
            'odometer_reading' => 12400,
            'fuel_level_percent' => 80,
            'cleanliness' => 'moderate',
            'damage_detected' => true,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('rental_checklists', [
            'car_rental_id' => $rental->id,
            'type' => 'return',
        ]);
    }

    public function test_completion_warns_without_return_checklist()
    {
        $driver = $this->createDriver();
        $rental = $this->createRental($driver, ['status' => 'in_progress']);

        // Tracking controller completion endpoint
        $response = $this->actingAs($driver, 'sanctum')->postJson("/api/driver-app/tracking/rental/{$rental->id}/status", [
            'status' => 'completed',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('completed', $rental->fresh()->status);
    }
}

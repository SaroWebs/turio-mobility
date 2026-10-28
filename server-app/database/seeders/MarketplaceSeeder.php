<?php

namespace Database\Seeders;

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class MarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        $categories = $this->seedCarCategories();
        $drivers = $this->seedDrivers();
        $this->seedVehicles($categories, $drivers);
        $this->seedCustomers();
    }

    private function seedCarCategories(): array
    {
        $rows = [
            ['Compact', 'hatchback', 4, 65, 15, 2100, 'petrol', 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1000&q=80'],
            ['Comfort Sedan', 'sedan', 4, 80, 18, 2900, 'petrol', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80'],
            ['Hill SUV', 'suv', 6, 110, 24, 4500, 'diesel', 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1000&q=80'],
            ['Premium MUV', 'muv', 7, 125, 27, 5200, 'diesel', 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1000&q=80'],
            ['Tempo Traveller', 'tempo_traveller', 12, 180, 34, 7800, 'diesel', 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1000&q=80'],
            ['Electric City', 'electric', 4, 70, 16, 2600, 'electric', 'https://images.unsplash.com/photo-1597404294360-feeeda04612e?auto=format&fit=crop&w=1000&q=80'],
        ];

        $categories = [];
        foreach ($rows as $index => [$name, $type, $seats, $baseFare, $perKm, $perDay, $fuel, $image]) {
            $category = CarCategory::updateOrCreate(
                ['slug' => Str::slug($name)],
                [
                    'name' => $name,
                    'description' => "{$name} vehicles selected for city, highway, and Northeast hill routes.",
                    'vehicle_type' => $type,
                    'seats' => $seats,
                    'has_ac' => true,
                    'has_driver' => true,
                    'base_fare' => $baseFare,
                    'price_per_km' => $perKm,
                    'price_per_minute' => 2.5,
                    'waiting_charge_per_min' => 2,
                    'min_fare' => $baseFare + 40,
                    'base_price_per_day' => $perDay,
                    'extra_km_charge' => $perKm,
                    'fuel_type' => $fuel,
                    'year' => 2024,
                    'features' => ['GPS', 'Air conditioning', 'USB charging', 'Emergency kit'],
                    'images' => [$image],
                    'is_active' => true,
                    'sort_order' => $index + 1,
                ],
            );
            $categories[] = $category;
        }

        return $categories;
    }

    private function seedDrivers(): array
    {
        $names = [
            ['Arup Das', 'Assamese'], ['Rinchen Tsering', 'Monpa'], ['Bantei Khongwir', 'Khasi'],
            ['Imsong Jamir', 'Ao'], ['Lalrinmawia', 'Mizo'], ['Thoiba Meitei', 'Manipuri'],
            ['Nima Lepcha', 'Nepali'], ['Priyanka Bora', 'Assamese'], ['Tashi Doma', 'Bhutia'],
            ['Meban Lyngdoh', 'Khasi'], ['Kenei Zeliang', 'Nagamese'], ['Rakesh Debbarma', 'Kokborok'],
        ];

        $drivers = [];
        foreach ($names as $index => [$name, $language]) {
            $driver = Driver::updateOrCreate(
                ['phone' => '70030'.str_pad((string) ($index + 1), 5, '0', STR_PAD_LEFT)],
                [
                    'name' => $name,
                    'email' => 'driver'.($index + 1).'@happymiles.test',
                    'password' => Hash::make('password'),
                    'license_number' => 'NE-DRV-'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT),
                    'license_expiry' => now()->addYears(3)->toDateString(),
                    'status' => 'active',
                    'is_online' => false,
                    'is_active' => true,
                    'is_approved' => true,
                    'approved_at' => now()->subMonths(3),
                    'rating' => 4.55 + (($index % 5) * 0.08),
                    'can_short_ride' => true,
                    'can_long_ride' => true,
                    'can_tour_lead' => $index % 3 === 0,
                    'can_tour_transport' => true,
                    'can_rental_delivery' => true,
                    'languages' => ['Hindi', 'English', $language],
                    'expertise_tags' => ['Northeast hill roads', 'Guest assistance', 'Safe driving'],
                    'certification_notes' => 'Seeded verified fleet partner.',
                    'phone_verified_at' => now()->subMonths(3),
                ],
            );
            DriverAvailability::updateOrCreate(
                ['driver_id' => $driver->id],
                ['status' => 'offline', 'is_available' => false, 'sharing_enabled' => $index % 2 === 0, 'sharing_seat_capacity' => 3, 'last_updated' => now()],
            );
            $drivers[] = $driver;
        }

        return $drivers;
    }

    private function seedVehicles(array $categories, array $drivers): void
    {
        $models = [
            ['Maruti Suzuki', 'Dzire'], ['Tata', 'Nexon'], ['Mahindra', 'Scorpio N'],
            ['Toyota', 'Innova Crysta'], ['Hyundai', 'Creta'], ['Kia', 'Carens'],
            ['Tata', 'Safari'], ['Mahindra', 'Bolero Neo'], ['Honda', 'Amaze'],
            ['Maruti Suzuki', 'Ertiga'], ['Toyota', 'Glanza'], ['Tata', 'Tigor EV'],
            ['Force', 'Traveller 12'], ['Mahindra', 'XUV700'], ['Toyota', 'Innova Hycross'],
        ];

        foreach ($models as $index => [$make, $model]) {
            $driver = $drivers[$index] ?? null;
            $category = $categories[$index % count($categories)];
            Vehicle::updateOrCreate(
                ['registration_number' => 'AS01HM'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT)],
                [
                    'car_category_id' => $category->id,
                    'driver_id' => $driver?->id,
                    'make' => $make,
                    'model' => $model,
                    'year' => 2021 + ($index % 5),
                    'color' => ['White', 'Silver', 'Blue', 'Grey', 'Black'][$index % 5],
                    'fuel_type' => $category->fuel_type,
                    'seats' => $category->seats,
                    'is_ac' => true,
                    'insurance_expiry' => now()->addYear()->toDateString(),
                    'permit_expiry' => now()->addMonths(10)->toDateString(),
                    'fitness_expiry' => now()->addMonths(14)->toDateString(),
                    'pollution_expiry' => now()->addMonths(6)->toDateString(),
                    'odometer_km' => 18000 + ($index * 4200),
                    'is_active' => true,
                    'condition' => $index % 7 === 0 ? 'good' : 'excellent',
                    'approval_status' => 'approved',
                    'reviewed_at' => now()->subMonth(),
                    'notes' => $driver ? "Assigned to {$driver->name}" : 'Available for driver assignment',
                ],
            );
        }
    }

    private function seedCustomers(): void
    {
        foreach (['Ananya Sharma', 'Rahul Deka', 'Isha Sen', 'Kabir Ahmed', 'Maya Gurung', 'Neha Roy'] as $index => $name) {
            Customer::updateOrCreate(
                ['phone' => '70040'.str_pad((string) ($index + 1), 5, '0', STR_PAD_LEFT)],
                [
                    'name' => $name,
                    'email' => 'customer'.($index + 1).'@happymiles.test',
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'phone_verified_at' => now()->subMonth(),
                ],
            );
        }
    }
}

<?php

namespace Database\Seeders;

use App\Models\CarRental;
use App\Models\CarRentalExtra;
use Illuminate\Database\Seeder;

class CarRentalExtraSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $rental = CarRental::first();
        if (!$rental) {
            $this->command?->warn('No car rental available to attach extras. Run DemoServerSeeder first.');

            return;
        }

        $extras = [
            [
                'car_rental_id' => $rental->id,
                'name' => 'GPS Navigation',
                'quantity' => 1,
                'unit_price' => 200.00,
                'total_price' => 200.00,
            ],
            [
                'car_rental_id' => $rental->id,
                'name' => 'Child Seat',
                'quantity' => 1,
                'unit_price' => 150.00,
                'total_price' => 150.00,
            ],
            [
                'car_rental_id' => $rental->id,
                'name' => 'Additional Driver',
                'quantity' => 1,
                'unit_price' => 300.00,
                'total_price' => 300.00,
            ],
            [
                'car_rental_id' => $rental->id,
                'name' => 'WiFi Hotspot',
                'quantity' => 1,
                'unit_price' => 100.00,
                'total_price' => 100.00,
            ],
            [
                'car_rental_id' => $rental->id,
                'name' => 'Refreshments Package',
                'quantity' => 1,
                'unit_price' => 250.00,
                'total_price' => 250.00,
            ],
            [
                'car_rental_id' => $rental->id,
                'name' => 'Toll Pass',
                'quantity' => 1,
                'unit_price' => 50.00,
                'total_price' => 50.00,
            ],
        ];

        foreach ($extras as $extra) {
            CarRentalExtra::create($extra);
        }
    }
}

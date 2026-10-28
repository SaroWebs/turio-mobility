<?php

namespace Database\Seeders;

use App\Models\CarCategory;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\Wallet;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DriverMockDataSeeder extends Seeder
{
    public function run(): void
    {
        $drivers = Driver::all();
        if ($drivers->isEmpty()) {
            $this->command->error('No drivers found. Run UserSeeder first.');

            return;
        }

        $customers = Customer::all();
        if ($customers->isEmpty()) {
            $this->command->error('No customers found. Run UserSeeder first.');

            return;
        }

        $carCategory = CarCategory::first();

        foreach ($drivers as $driver) {
            $this->command->info("Seeding data for driver: {$driver->name}");

            // 1. Past Rides (Completed)
            for ($i = 1; $i <= 5; $i++) {
                $customer = $customers->random();
                $scheduledAt = Carbon::now()->subDays(rand(1, 30))->subHours(rand(1, 10));

                $fare = rand(200, 1500);
                $commission = $fare * 0.1;
                $driverShare = $fare - $commission;

                RideBooking::create([
                    'booking_number' => 'RIDE'.strtoupper(Str::random(10)),
                    'customer_id' => $customer->id,
                    'driver_id' => $driver->id,
                    'car_category_id' => $carCategory->id,
                    'customer_name' => $customer->name,
                    'customer_phone' => $customer->phone,
                    'pickup_location' => 'Baga Beach, Goa',
                    'dropoff_location' => 'Goa International Airport',
                    'scheduled_at' => $scheduledAt,
                    'started_at' => $scheduledAt->copy()->addMinutes(5),
                    'completed_at' => $scheduledAt->copy()->addMinutes(45),
                    'status' => 'completed',
                    'payment_status' => 'paid',
                    'total_fare' => $fare,
                    'commission_amount' => $commission,
                    'driver_share' => $driverShare,
                ]);
            }

            // 2. Wallet & Transactions
            $balance = rand(10000, 50000);
            $wallet = $driver->wallet()->firstOrCreate([], [
                'balance' => $balance,
                'currency' => 'INR',
                'is_active' => true,
            ]);

            $wallet->transactions()->create([
                'type' => 'credit',
                'amount' => 1200.00,
                'balance_before' => $balance - 1200.00,
                'balance_after' => $balance,
                'description' => 'Ride Earnings - '.Str::random(8),
                'status' => 'completed',
                'created_at' => Carbon::now()->subHours(2),
            ]);
        }

        // 3. Pending/Incoming Rides (Generic)
        for ($i = 1; $i <= 3; $i++) {
            $customer = $customers->random();
            $scheduledAt = Carbon::now()->addHours(rand(1, 24));

            RideBooking::create([
                'booking_number' => 'RIDE'.strtoupper(Str::random(10)),
                'customer_id' => $customer->id,
                'driver_id' => null,
                'car_category_id' => $carCategory->id,
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone,
                'pickup_location' => 'Panjim City Center',
                'dropoff_location' => 'Calangute Beach',
                'scheduled_at' => $scheduledAt,
                'status' => 'pending',
                'total_fare' => rand(300, 800),
            ]);
        }

        $this->command->info('Seeded mock data for all drivers.');
    }
}

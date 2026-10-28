<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Driver;
use Illuminate\Database\Seeder;

class WalletSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\Setting::updateOrCreate(['key' => 'driver.minimum_topup_minor'], ['value' => '50000']);
        \App\Models\Setting::updateOrCreate(['key' => 'driver.dispatch_eligible_balance_minor'], ['value' => '10000']);
        \App\Models\Setting::updateOrCreate(['key' => 'driver.warning_balance_minor'], ['value' => '50000']);

        $drivers = Driver::all();

        foreach ($drivers as $driver) {
            $transactions = [
                ['type' => 'credit', 'amount' => 10000, 'description' => 'Initial wallet top-up'],
                ['type' => 'credit', 'amount' => 5000, 'description' => 'Payment for booking RIDE20251201ABCD'],
                ['type' => 'debit', 'amount' => 1000, 'description' => 'Commission for booking RIDE20251201ABCD'],
                ['type' => 'debit', 'amount' => 2000, 'description' => 'Driver withdrawal'],
                ['type' => 'credit', 'amount' => 8000, 'description' => 'Payment for booking RIDE20251202EFGH'],
                ['type' => 'debit', 'amount' => 800, 'description' => 'Commission for booking RIDE20251202EFGH'],
            ];

            $running = 0;
            foreach ($transactions as $tx) {
                $running += $tx['amount'];
            }

            $wallet = $driver->wallet()->firstOrCreate([], [
                'balance' => $running,
                'currency' => 'INR',
                'is_active' => true,
            ]);

            $running = 0;
            foreach ($transactions as $tx) {
                $balanceBefore = $running;
                $running += $tx['amount'];
                $wallet->transactions()->create(array_merge($tx, [
                    'balance_before' => $balanceBefore,
                    'balance_after' => $running,
                    'status' => 'completed',
                ]));
            }
        }

        $customers = Customer::limit(3)->get();

        foreach ($customers as $customer) {
            $wallet = $customer->wallet()->firstOrCreate([], [
                'balance' => 5000,
                'currency' => 'INR',
                'is_active' => true,
            ]);

            $wallet->transactions()->create([
                'type' => 'credit',
                'amount' => 5000,
                'balance_before' => 0,
                'balance_after' => 5000,
                'description' => 'Wallet top-up via credit card',
                'status' => 'completed',
            ]);
        }
    }
}

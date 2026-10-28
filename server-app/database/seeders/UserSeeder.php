<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            ['admin@skyslope.com', 'SkySlope Administrator', '7002000000'],
            ['operations.admin@skyslope.com', 'Operations Administrator', '7002000001'],
            ['content.admin@skyslope.com', 'Content Administrator', '7002000002'],
        ] as [$email, $name, $phone]) {
            $user = User::where('email', $email)->first();
            if (! $user) {
                $password = config('seeding.admin_password');
                if (! $password) {
                    throw new \RuntimeException('Set SEED_ADMIN_PASSWORD before creating seeded administrators.');
                }
                $user = User::create(['email' => $email, 'name' => $name, 'phone' => $phone, 'password' => $password]);
                $user->forceFill(['email_verified_at' => now()])->save();
            }
            $user->assignRole('admin');
        }
    }
}

<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            // Level 0: Foundation — no dependencies
            RolePermissionSeeder::class,
            VerificationPermissionSeeder::class,
            PlaceCategorySeeder::class,
            CarCategorySeeder::class,

            // Level 1: Users — depends on roles
            UserSeeder::class,

            // Level 2: Northeast catalog — depends on admin user
            NortheastCatalogSeeder::class,

            // Level 3: Marketplace fleet — depends on catalog
            MarketplaceSeeder::class,

            // Level 4: Demo data — depends on admin user
            DemoServerSeeder::class,

            // Level 4: CMS & promotions — depends on users
            CmsContentSeeder::class,
            CustomerCouponSeeder::class,

            // Level 5: Driver activity — depends on drivers + customers
            DriverMockDataSeeder::class,

            // Level 5: Extensions — depend on rentals/customers/drivers
            CarRentalExtraSeeder::class,
            InsuranceSeeder::class,
            WalletSeeder::class,
        ]);

        $this->command?->info('Database populated with permissions, roles, admin users, catalog, fleet, CMS, coupons, and demo data.');
        $this->command?->info('Administrators: admin@skyslope.com, operations.admin@skyslope.com, content.admin@skyslope.com. Existing passwords are preserved.');
    }
}

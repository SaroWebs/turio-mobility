<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class PlaceSeeder extends Seeder
{
    public function run(): void
    {
        app(NortheastCatalogSeeder::class)->seedPlaces(\App\Models\User::where('email', 'admin@skyslope.com')->firstOrFail());
    }
}

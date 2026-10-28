<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DestinationSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = app(NortheastCatalogSeeder::class);
        $places = $catalog->seedPlaces(\App\Models\User::where('email', 'admin@skyslope.com')->firstOrFail());
        $catalog->seedDestinations($places);
    }
}

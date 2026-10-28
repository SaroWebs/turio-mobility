<?php

namespace Database\Seeders;

use App\Models\CarCategory;
use Illuminate\Database\Seeder;

class CarCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $carCategories = [
            [
                'name' => 'Innova Crysta',
                'slug' => 'innova-crysta',
                'description' => 'Premium 7-seater SUV perfect for family trips and long journeys',
                'vehicle_type' => 'suv',
                'seats' => 7,
                'has_ac' => true,
                'has_driver' => true,
                'base_price_per_day' => 3500,
                'price_per_km' => 15,
                'features' => ['GPS Navigation', 'Music System', 'Charging Ports', 'Comfortable Seating'],
                'fuel_type' => 'diesel',
                'year' => 2023,
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'Swift Dzire',
                'slug' => 'swift-dzire',
                'description' => 'Compact sedan ideal for city travel and small groups',
                'vehicle_type' => 'sedan',
                'seats' => 4,
                'has_ac' => true,
                'has_driver' => true,
                'base_price_per_day' => 2500,
                'price_per_km' => 12,
                'features' => ['Air Conditioning', 'Music System', 'Comfortable Seats'],
                'fuel_type' => 'petrol',
                'year' => 2022,
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'name' => 'Tempo Traveller (AC)',
                'slug' => 'tempo-traveller-ac',
                'description' => 'Spacious 13-seater with air conditioning for group travel',
                'vehicle_type' => 'tempo_traveller',
                'seats' => 13,
                'has_ac' => true,
                'has_driver' => true,
                'base_price_per_day' => 5500,
                'price_per_km' => 25,
                'features' => ['Air Conditioning', 'Pushback Seats', 'Music System', 'Large Windows'],
                'fuel_type' => 'diesel',
                'year' => 2023,
                'is_active' => true,
                'sort_order' => 3,
            ],
            [
                'name' => 'Tempo Traveller (Non-AC)',
                'slug' => 'tempo-traveller-non-ac',
                'description' => 'Economical 17-seater for larger groups and budget travel',
                'vehicle_type' => 'tempo_traveller',
                'seats' => 17,
                'has_ac' => false,
                'has_driver' => true,
                'base_price_per_day' => 4500,
                'price_per_km' => 20,
                'features' => ['Spacious Seating', 'Music System', 'Comfortable for Groups'],
                'fuel_type' => 'diesel',
                'year' => 2022,
                'is_active' => true,
                'sort_order' => 4,
            ],
            [
                'name' => 'Luxury Sedan',
                'slug' => 'luxury-sedan',
                'description' => 'Premium sedan with luxury features for executive travel',
                'vehicle_type' => 'sedan',
                'seats' => 4,
                'has_ac' => true,
                'has_driver' => true,
                'base_price_per_day' => 4000,
                'price_per_km' => 18,
                'features' => ['Premium Interior', 'Climate Control', 'Premium Sound System', 'Leather Seats'],
                'fuel_type' => 'petrol',
                'year' => 2023,
                'is_active' => true,
                'sort_order' => 5,
            ],
        ];

        foreach ($carCategories as $category) {
            CarCategory::updateOrCreate(['slug' => $category['slug']], $category);
        }
    }
}

<?php

namespace Database\Seeders;

use App\Models\PlaceCategory;
use Illuminate\Database\Seeder;

class PlaceCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Historical Sites',
                'description' => 'Ancient monuments, forts, and historical landmarks',
                'icon' => 'landmark',
                'color' => '#8B4513',
                'is_active' => true,
            ],
            [
                'name' => 'Natural Attractions',
                'description' => 'Parks, gardens, waterfalls, and natural wonders',
                'icon' => 'tree',
                'color' => '#228B22',
                'is_active' => true,
            ],
            [
                'name' => 'Religious Sites',
                'description' => 'Temples, churches, mosques, and spiritual places',
                'icon' => 'church',
                'color' => '#4169E1',
                'is_active' => true,
            ],
            [
                'name' => 'Shopping Areas',
                'description' => 'Malls, markets, and shopping districts',
                'icon' => 'shopping-bag',
                'color' => '#FF69B4',
                'is_active' => true,
            ],
            [
                'name' => 'Entertainment',
                'description' => 'Theaters, amusement parks, and entertainment venues',
                'icon' => 'theater',
                'color' => '#FFD700',
                'is_active' => true,
            ],
            [
                'name' => 'Restaurants & Cafes',
                'description' => 'Dining places and food courts',
                'icon' => 'utensils',
                'color' => '#FF4500',
                'is_active' => true,
            ],
            [
                'name' => 'Accommodation',
                'description' => 'Hotels, resorts, and guest houses',
                'icon' => 'hotel',
                'color' => '#9370DB',
                'is_active' => true,
            ],
            [
                'name' => 'Transportation',
                'description' => 'Airports, railway stations, and bus stands',
                'icon' => 'train',
                'color' => '#2F4F4F',
                'is_active' => true,
            ],
        ];

        foreach ($categories as $category) {
            unset($category['color']);
            PlaceCategory::updateOrCreate(['slug' => \Illuminate\Support\Str::slug($category['name'])], $category);
        }
    }
}

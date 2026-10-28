<?php

namespace Database\Seeders;

use App\Models\CmsContent;
use Illuminate\Database\Seeder;

class CmsContentSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['common', 'global', 'brand', 'name', 'text', 'Turiya Mobility'],
            ['common', 'global', 'brand', 'tagline', 'text', 'Tours - Rides - Rentals'],
            ['customer-web', 'home', 'hero', 'eyebrow', 'text', 'NORTHEAST INDIA · READY WHEN YOU ARE'],
            ['customer-web', 'home', 'hero', 'title', 'text', 'Go somewhere. Feel ready.'],
            ['customer-web', 'home', 'hero', 'description', 'text', 'Book dependable rides, rentals, and locally designed tours across the eight states of Northeast India.'],
            ['customer-web', 'home', 'hero', 'image', 'image', 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1800&q=85'],
            ['customer-web', 'home', 'destinations', 'kicker', 'text', '01 · Places'],
            ['customer-web', 'home', 'destinations', 'title', 'text', 'Stories worth travelling for'],
            ['customer-web', 'home', 'tours', 'kicker', 'text', '02 · Tours'],
            ['customer-web', 'home', 'tours', 'title', 'text', 'Scheduled Northeast experiences'],
            ['customer-web', 'home', 'rentals', 'kicker', 'text', '03 · Rentals'],
            ['customer-web', 'home', 'rentals', 'title', 'text', 'Hill-ready cars for flexible plans'],
            ['customer-web', 'global', 'footer', 'description', 'text', 'Plan, book, follow, and understand every Northeast journey in one calm place.'],
            ['customer-mobile', 'splash', 'main', 'title', 'text', 'Turiya Mobility'],
            ['customer-mobile', 'splash', 'main', 'subtitle', 'text', 'Tours - Rides - Rentals'],
            ['customer-mobile', 'splash', 'main', 'image', 'image', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85'],
            ['customer-mobile', 'home', 'rides', 'title', 'text', 'Suggested for you'],
            ['customer-mobile', 'home', 'rides', 'search_placeholder', 'text', 'Where would you like to go?'],
            ['customer-mobile', 'home', 'tours', 'title', 'text', 'Curated Northeast tours'],
            ['driver-app', 'splash', 'main', 'title', 'text', 'Turiya Mobility Driver'],
            ['driver-app', 'splash', 'main', 'subtitle', 'text', 'Tours - Rides - Rentals'],
            ['driver-app', 'splash', 'main', 'image', 'image', 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=85'],
            ['driver-app', 'dashboard', 'availability', 'online_title', 'text', 'You are Online'],
            ['driver-app', 'dashboard', 'availability', 'offline_title', 'text', 'You are Offline'],
            ['driver-app', 'dashboard', 'active_trip', 'title', 'text', 'Active Trip in Progress'],
            ['driver-app', 'dashboard', 'active_trip', 'subtitle', 'text', 'Tap to resume navigation and tools'],
        ];

        foreach ($rows as $sortOrder => [$app, $page, $section, $key, $type, $value]) {
            CmsContent::updateOrCreate(
                compact('app', 'page', 'section', 'key'),
                [
                    'type' => $type,
                    'value' => $value,
                    'sort_order' => $sortOrder,
                    'is_active' => true,
                ],
            );
        }
    }
}

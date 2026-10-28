<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->replaceDefault('common', 'global', 'brand', 'name', 'HappyMiles', 'Turiya Mobility');
        $this->replaceDefault('common', 'global', 'brand', 'tagline', 'Your travel system for Northeast India', 'Tours - Rides - Rentals');
        $this->replaceDefault('customer-mobile', 'splash', 'main', 'title', 'HappyMiles', 'Turiya Mobility');
        $this->replaceDefault('customer-mobile', 'splash', 'main', 'subtitle', 'Northeast journeys, connected', 'Tours - Rides - Rentals');
        $this->replaceDefault('driver-app', 'splash', 'main', 'title', 'HappyMiles Driver', 'Turiya Mobility Driver');
        $this->replaceDefault('driver-app', 'splash', 'main', 'subtitle', 'Your road. Your work.', 'Tours - Rides - Rentals');
    }

    public function down(): void
    {
        $this->replaceDefault('common', 'global', 'brand', 'name', 'Turiya Mobility', 'HappyMiles');
        $this->replaceDefault('common', 'global', 'brand', 'tagline', 'Tours - Rides - Rentals', 'Your travel system for Northeast India');
        $this->replaceDefault('customer-mobile', 'splash', 'main', 'title', 'Turiya Mobility', 'HappyMiles');
        $this->replaceDefault('customer-mobile', 'splash', 'main', 'subtitle', 'Tours - Rides - Rentals', 'Northeast journeys, connected');
        $this->replaceDefault('driver-app', 'splash', 'main', 'title', 'Turiya Mobility Driver', 'HappyMiles Driver');
        $this->replaceDefault('driver-app', 'splash', 'main', 'subtitle', 'Tours - Rides - Rentals', 'Your road. Your work.');
    }

    private function replaceDefault(string $app, string $page, string $section, string $key, string $from, string $to): void
    {
        DB::table('cms_contents')
            ->where(compact('app', 'page', 'section', 'key'))
            ->where('value', $from)
            ->update(['value' => $to]);
    }
};

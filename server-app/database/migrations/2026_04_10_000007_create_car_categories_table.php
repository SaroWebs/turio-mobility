<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('car_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');        // Innova Crysta, Swift Dzire, Tempo Traveller 12-Seater
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('vehicle_type'); // hatchback, sedan, suv, luxury, tempo_traveller, bus, bike

            // Capacity
            $table->unsignedInteger('seats');
            $table->boolean('has_ac')->default(true);
            $table->boolean('has_driver')->default(true); // false = self-drive

            // ---- Ola/Uber Ride Fare ----
            $table->decimal('base_fare', 10, 2)->default(0);        // flat booking fee
            $table->decimal('price_per_km', 8, 2)->default(0);      // per km charge
            $table->decimal('price_per_minute', 8, 2)->default(0);  // time-based
            $table->decimal('waiting_charge_per_min', 8, 2)->default(0);
            $table->decimal('min_fare', 10, 2)->default(0);         // minimum ride fare

            // ---- Car Rental (daily) ----
            $table->decimal('base_price_per_day', 10, 2)->default(0);
            $table->decimal('extra_km_charge', 8, 2)->default(0);   // beyond included km

            // Metadata
            $table->string('fuel_type')->default('petrol'); // petrol, diesel, electric, cng
            $table->integer('year')->nullable();
            $table->json('features')->nullable(); // ['GPS', 'Music System', 'USB Charging']
            $table->json('images')->nullable();
            $table->string('icon')->nullable(); // icon class or URL
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
            $table->index('vehicle_type');
            $table->unsignedInteger('included_km_per_day')->nullable();
            $table->unsignedInteger('included_hours_per_day')->nullable();
            $table->decimal('extra_hour_charge', 10, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('car_categories');
    }
};

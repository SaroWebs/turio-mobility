<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('place_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('place_id')->constrained('places')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('review')->nullable();
            $table->timestamps();

            $table->unique(['place_id', 'customer_id']);
            $table->index('place_id');
        });

        Schema::create('tour_booking_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tour_booking_id')->constrained('tour_bookings')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->unsignedTinyInteger('tour_rating')->nullable();
            $table->unsignedTinyInteger('driver_rating')->nullable();
            $table->text('review')->nullable();
            $table->timestamps();

            $table->unique(['tour_booking_id', 'customer_id']);
        });

        Schema::create('car_rental_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_rental_id')->constrained('car_rentals')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->unsignedTinyInteger('rental_rating')->nullable();
            $table->unsignedTinyInteger('driver_rating')->nullable();
            $table->text('review')->nullable();
            $table->timestamps();

            $table->unique(['car_rental_id', 'customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('car_rental_reviews');
        Schema::dropIfExists('tour_booking_reviews');
        Schema::dropIfExists('place_reviews');
    }
};

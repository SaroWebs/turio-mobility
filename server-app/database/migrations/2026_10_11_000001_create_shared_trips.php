<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shared_trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('drivers');
            $table->foreignId('vehicle_id')->constrained('vehicles');
            $table->foreignId('root_booking_id')->unique()->constrained('ride_bookings');
            $table->boolean('accepting')->default(true);
            $table->boolean('allow_extension')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->json('stops');
            $table->json('geometry');
            $table->json('original_destination');
            $table->timestamp('ends_at');
            $table->timestamp('original_ends_at');
            $table->timestamps();
            $table->index(['driver_id', 'accepting']);
        });
        Schema::table('ride_bookings', function (Blueprint $table) {
            $table->foreignId('shared_trip_id')->nullable()->constrained('shared_trips');
            $table->uuid('shared_offer_id')->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('ride_bookings', function (Blueprint $table) {
            $table->dropForeign(['shared_trip_id']);
            $table->dropColumn(['shared_trip_id', 'shared_offer_id']);
        });
        Schema::dropIfExists('shared_trips');
    }
};

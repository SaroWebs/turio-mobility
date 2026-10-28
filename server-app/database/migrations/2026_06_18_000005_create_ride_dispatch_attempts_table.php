<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ride_dispatch_attempts')) {
            Schema::create('ride_dispatch_attempts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('ride_booking_id')->constrained('ride_bookings')->cascadeOnDelete();
                $table->foreignId('driver_id')->constrained('drivers')->cascadeOnDelete();
                $table->decimal('score', 8, 2)->default(0);
                $table->decimal('distance_km', 8, 2)->nullable();
                $table->unsignedInteger('rank')->nullable();
                $table->enum('status', ['offered', 'accepted', 'declined', 'expired', 'superseded'])->default('offered');
                $table->timestamp('offered_at')->nullable();
                $table->timestamp('responded_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->text('decline_reason')->nullable();
                $table->timestamps();

                $table->unique(['ride_booking_id', 'driver_id']);
                $table->index(['driver_id', 'status']);
                $table->index(['ride_booking_id', 'status']);
                $table->index('expires_at');
            $table->index(['status', 'expires_at'], 'idx_rda_status_expires');
            $table->index(['driver_id', 'status', 'created_at'], 'idx_rda_driver_status_created');
            $table->unsignedInteger('wave_number')->default(1);
            $table->index(['ride_booking_id', 'wave_number']);
            $table->integer('response_time_seconds')->nullable();
        });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ride_dispatch_attempts');
    }
};

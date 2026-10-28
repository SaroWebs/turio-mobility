<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_trackers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->unique()->constrained('vehicles')->cascadeOnDelete();
            $table->string('device_uid')->unique();
            $table->string('token_hash', 64)->nullable()->unique();
            $table->enum('status', ['unprovisioned', 'active', 'suspended', 'faulty'])->default('unprovisioned');
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->decimal('heading', 5, 2)->nullable();
            $table->decimal('speed_kmh', 6, 2)->nullable();
            $table->decimal('accuracy_m', 8, 2)->nullable();
            $table->unsignedTinyInteger('battery_percent')->nullable();
            $table->boolean('ignition_on')->nullable();
            $table->timestamp('installed_at')->nullable();
            $table->timestamp('last_ping_at')->nullable();
            $table->timestamp('last_recorded_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'last_ping_at']);
        });

        Schema::create('vehicle_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->foreignId('vehicle_tracker_id')->constrained('vehicle_trackers')->cascadeOnDelete();
            $table->unsignedBigInteger('sequence_number')->nullable();
            $table->decimal('latitude', 10, 8);
            $table->decimal('longitude', 11, 8);
            $table->decimal('heading', 5, 2)->nullable();
            $table->decimal('speed_kmh', 6, 2)->nullable();
            $table->decimal('accuracy_m', 8, 2)->nullable();
            $table->unsignedTinyInteger('battery_percent')->nullable();
            $table->boolean('ignition_on')->nullable();
            $table->timestamp('recorded_at');
            $table->timestamp('received_at');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['vehicle_tracker_id', 'sequence_number'], 'vehicle_tracker_sequence_unique');
            $table->index(['vehicle_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_locations');
        Schema::dropIfExists('vehicle_trackers');
    }
};

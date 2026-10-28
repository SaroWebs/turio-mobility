<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_zones', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // "Guwahati Metro", "Remote Hills"
            $table->text('description')->nullable();

            // Circle model (center + radius) — resolved with the same Haversine helper
            // used across dispatch/estimate, so it works identically on SQLite and MySQL.
            $table->decimal('center_lat', 10, 7);
            $table->decimal('center_lng', 10, 7);
            $table->decimal('radius_km', 6, 2);

            $table->integer('priority')->default(0); // overlap tiebreak: higher wins
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_zones');
    }
};

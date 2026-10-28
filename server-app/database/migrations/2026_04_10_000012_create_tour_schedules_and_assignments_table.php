<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tour Schedules — specific departure dates with seat inventory
        Schema::create('tour_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tour_id')->constrained('tours')->cascadeOnDelete();
            $table->date('departure_date');
            $table->date('return_date');
            $table->time('departure_time')->default('06:00');
            $table->string('departure_point')->nullable(); // pickup point

            // Seat management
            $table->unsignedInteger('total_seats');
            $table->unsignedInteger('booked_seats')->default(0);
            $table->unsignedInteger('reserved_seats')->default(0); // held for pending payments

            // Pricing override (null = use tour base price)
            $table->decimal('price_override', 10, 2)->nullable();
            $table->decimal('child_price_override', 10, 2)->nullable();

            $table->enum('status', ['open', 'sold_out', 'closed', 'cancelled', 'completed'])->default('open');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tour_id', 'departure_date', 'status']);
            $table->index('departure_date');
            $table->dateTime('departure_at')->nullable()->index();
        });

        // Which guides are assigned to each schedule
        Schema::create('tour_guide_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tour_schedule_id')->constrained('tour_schedules')->cascadeOnDelete();
            $table->foreignId('guide_id')->constrained('guides')->cascadeOnDelete();
            $table->enum('role', ['lead', 'assistant'])->default('lead');
            $table->enum('status', ['assigned', 'accepted', 'declined', 'completed'])->default('assigned');
            $table->decimal('fee', 10, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tour_schedule_id', 'guide_id']);
            $table->index('guide_id');
        });

        // Which drivers are assigned to each schedule
        Schema::create('tour_driver_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tour_schedule_id')->constrained('tour_schedules')->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained('drivers')->cascadeOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();
            $table->enum('status', ['assigned', 'accepted', 'declined', 'completed'])->default('assigned');
            $table->decimal('fee', 10, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tour_schedule_id', 'driver_id']);
            $table->index('driver_id');
            $table->string('role', 40)->default('transport');
            $table->index(['driver_id', 'status', 'created_at'], 'idx_tda_driver_status_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tour_driver_assignments');
        Schema::dropIfExists('tour_guide_assignments');
        Schema::dropIfExists('tour_schedules');
    }
};

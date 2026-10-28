<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_category_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('drivers')->nullOnDelete();

            // Identity
            $table->string('registration_number')->unique(); // plate number
            $table->string('make');         // Toyota, Maruti, Mahindra
            $table->string('model');        // Innova Crysta, Swift, Scorpio
            $table->integer('year');
            $table->string('color');
            $table->string('vin')->nullable(); // Vehicle Identification Number
            $table->string('fuel_type')->default('petrol');
            $table->unsignedInteger('seats');
            $table->boolean('is_ac')->default(true);

            // Documents & Compliance
            $table->date('insurance_expiry')->nullable();
            $table->date('permit_expiry')->nullable();
            $table->date('fitness_expiry')->nullable();
            $table->date('pollution_expiry')->nullable();

            // Odometer
            $table->unsignedInteger('odometer_km')->default(0);

            // Status
            $table->boolean('is_active')->default(true);
            $table->enum('condition', ['excellent', 'good', 'fair', 'under_maintenance'])->default('good');

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['driver_id', 'is_active']);
            $table->index(['car_category_id', 'is_active']);
            $table->string('approval_status', 20)->default('approved');
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->unique('driver_id', 'vehicles_driver_id_unique');
            $table->boolean('is_available_for_rent')
                ->default(false)

                ->index();
            $table->string('tracking_preference')->default('automatic');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};

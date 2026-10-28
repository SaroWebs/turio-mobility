<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rental_checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_rental_id')->constrained('car_rentals')->cascadeOnDelete();
            $table->enum('type', ['handover', 'return']);
            
            // The person completing the checklist (driver or admin)
            $table->string('completed_by_type');
            $table->unsignedBigInteger('completed_by_id');
            
            $table->decimal('odometer_reading', 10, 2)->nullable();
            $table->unsignedTinyInteger('fuel_level_percent')->nullable();
            $table->enum('cleanliness', ['clean', 'moderate', 'dirty'])->nullable();
            
            // e.g. spare_tire, jack_tools, registration_docs, first_aid_kit, ac_working, lights_working
            $table->json('checklist_items')->nullable();
            
            // array of URLs: front, back, left, right, interior, dashboard
            $table->json('photos')->nullable();
            
            $table->boolean('damage_detected')->default(false);
            $table->text('damage_notes')->nullable();
            
            $table->boolean('customer_acknowledged')->default(false);
            
            $table->timestamps();

            // Ensure we don't have multiple checklists of the same type for a rental
            $table->unique(['car_rental_id', 'type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rental_checklists');
    }
};

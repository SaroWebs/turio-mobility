<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drivers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email', 191)->nullable()->unique();
            $table->string('phone', 20)->unique();
            $table->string('password')->nullable();
            $table->string('profile_photo')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();

            // License & Vehicle
            $table->string('license_number')->nullable();
            $table->date('license_expiry')->nullable();
            $table->string('vehicle_type')->nullable(); // sedan, suv, etc.
            $table->string('vehicle_number')->nullable();
            $table->string('vehicle_model')->nullable();
            $table->string('vehicle_color')->nullable();
            $table->integer('vehicle_year')->nullable();

            // Status
            $table->enum('status', ['pending', 'active', 'suspended', 'rejected'])->default('pending');
            $table->boolean('is_online')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_approved')->default(false);
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable(); // user_id (admin)

            // Performance
            $table->decimal('rating', 3, 2)->nullable();
            $table->unsignedInteger('total_rides')->default(0);
            $table->unsignedInteger('total_tours')->default(0);

            // Banking
            $table->string('bank_account_number')->nullable();
            $table->string('bank_account_name')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('ifsc_code')->nullable();

            // Auth
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('phone_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();

            $table->index('phone');
            $table->index(['status', 'is_online']);
            $table->index('is_approved');
            $table->boolean('can_short_ride')->default(true);
            $table->boolean('can_long_ride')->default(true);
            $table->boolean('can_tour_lead')->default(false);
            $table->boolean('can_tour_transport')->default(false);
            $table->boolean('can_rental_delivery')->default(true);
            $table->json('languages')->nullable();
            $table->json('expertise_tags')->nullable();
            $table->text('certification_notes')->nullable();
            $table->softDeletes();
            $table->boolean('funding_eligible')->default(false);
            $table->timestamp('funding_activated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drivers');
    }
};

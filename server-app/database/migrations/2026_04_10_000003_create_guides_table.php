<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guides', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email', 191)->nullable()->unique();
            $table->string('phone', 20)->unique();
            $table->string('password')->nullable();
            $table->string('profile_photo')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();

            // Guide-specific
            $table->text('bio')->nullable();
            $table->json('languages')->nullable();        // ['English', 'Hindi', 'Tamil']
            $table->json('specializations')->nullable();  // ['Wildlife', 'Historical', 'Adventure']
            $table->unsignedInteger('experience_years')->default(0);
            $table->string('certification_number')->nullable();
            $table->date('certification_expiry')->nullable();

            // Status
            $table->enum('status', ['pending', 'active', 'suspended', 'rejected'])->default('pending');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_approved')->default(false);
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable(); // admin user_id

            // Performance
            $table->decimal('rating', 3, 2)->nullable();
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
            $table->index('status');
            $table->index('is_approved');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guides');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_insurance_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->string('policy_number')->unique();
            $table->string('product_code');
            $table->string('provider_name');
            $table->decimal('coverage_amount', 12, 2);
            $table->decimal('premium', 10, 2)->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status')->default('pending_verification');
            $table->string('terms_version');
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['driver_id', 'status', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_insurance_policies');
    }
};

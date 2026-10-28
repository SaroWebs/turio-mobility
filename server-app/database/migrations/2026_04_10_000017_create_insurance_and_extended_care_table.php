<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('insurance_policies', function (Blueprint $table) {
            $table->id();
            $table->string('policy_number')->unique();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();

            // Polymorphic coverage: RideBooking or CarRental
            $table->nullableMorphs('coverable');

            $table->string('policy_type');     // basic, comprehensive, premium
            $table->decimal('premium', 10, 2)->default(0);
            $table->decimal('coverage_amount', 12, 2)->default(0);
            $table->date('start_date');
            $table->date('end_date');
            $table->enum('status', ['active', 'expired', 'cancelled', 'claimed'])->default('active');
            $table->text('terms')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->string('product_code')->nullable();
            $table->string('provider_name')->nullable();
            $table->string('terms_version')->nullable();
            $table->timestamp('terms_accepted_at')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->unique(['coverable_type', 'coverable_id'], 'insurance_coverable_unique');
        });

        Schema::create('insurance_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('insurance_policy_id')->constrained('insurance_policies')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('claim_number')->unique();
            $table->text('description');
            $table->decimal('claim_amount', 12, 2);
            $table->decimal('approved_amount', 12, 2)->nullable();
            $table->enum('status', ['pending', 'under_review', 'approved', 'rejected', 'paid'])->default('pending');
            $table->text('admin_notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->date('incident_date')->nullable();
            $table->json('documents')->nullable();
        });

        Schema::create('extended_care', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->nullableMorphs('serviceable'); // RideBooking or CarRental
            $table->string('care_type');           // roadside_assistance, medical, etc.
            $table->text('description')->nullable();
            $table->string('status')->default('pending');
            $table->decimal('cost', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('extended_care');
        Schema::dropIfExists('insurance_claims');
        Schema::dropIfExists('insurance_policies');
    }
};

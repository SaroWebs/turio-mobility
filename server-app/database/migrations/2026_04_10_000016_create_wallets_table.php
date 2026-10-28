<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Polymorphic wallet: Customer or Driver can own a wallet
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->morphs('owner'); // owner_type, owner_id
            $table->decimal('balance', 12, 2)->default(0);
            $table->string('currency', 3)->default('INR');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['owner_type', 'owner_id']);
            $table->bigInteger('balance_minor')->nullable();
        });

        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained('wallets')->cascadeOnDelete();
            $table->enum('type', ['credit', 'debit']);
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_before', 12, 2);
            $table->decimal('balance_after', 12, 2);
            // Polymorphic reference: e.g. RideBooking, CarRental, TourBooking
            $table->string('reference_type')->nullable();
            $table->string('reference_id')->nullable();
            $table->string('description')->nullable();
            $table->string('status')->default('completed');
            $table->timestamps();

            $table->index('wallet_id');
            $table->index(['reference_type', 'reference_id']);
            $table->string('idempotency_key')->nullable();
            $table->unique('idempotency_key');
            $table->unsignedBigInteger('amount_minor')->nullable();
            $table->bigInteger('balance_before_minor')->nullable();
            $table->bigInteger('balance_after_minor')->nullable();
            $table->uuid('transaction_ref')->nullable();
            $table->index('transaction_ref');
        });

        // Polymorphic withdrawal: Customer or Driver
        Schema::create('withdrawal_requests', function (Blueprint $table) {
            $table->id();
            $table->morphs('owner');
            $table->decimal('amount', 12, 2);
            $table->string('method')->default('bank_transfer'); // bank_transfer, upi
            $table->json('account_details');    // { account_number, bank, name, ifsc / upi_id }
            $table->enum('status', ['pending', 'processing', 'completed', 'rejected'])->default('pending');
            $table->text('admin_notes')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->unsignedBigInteger('processed_by')->nullable(); // admin user_id
            $table->timestamps();

            $table->index(['owner_type', 'owner_id', 'status']);
            $table->index('status');
            $table->string('rejection_reason')->nullable();
            $table->string('utr_number')->nullable();
            $table->string('razorpay_fund_account_id')->nullable();
            $table->string('razorpay_payout_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('withdrawal_requests');
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('wallets');
    }
};

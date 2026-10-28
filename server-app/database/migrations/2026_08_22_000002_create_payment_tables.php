<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Payment domain (SKY-MRD-001 §6.1): explicit order → payment → payout
 * lifecycle tables. These are the authoritative record of the payment state
 * machine; booking `payment_status` columns are kept as a mirror so frozen
 * mobile/driver clients keep reading the field they already consume.
 *
 * All amounts are integer minor units (paise). Provider identifiers are unique
 * so webhook redelivery / duplicate captures are idempotent at the DB level.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Intent to collect money — maps to a Razorpay order.
        Schema::create('payment_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->string('provider')->default('razorpay');
            $table->string('provider_order_id')->nullable()->unique();
            $table->nullableMorphs('payable');          // RideBooking / TourBooking / CarRental / Wallet top-up
            $table->nullableMorphs('owner');            // Customer / Driver
            $table->unsignedBigInteger('amount_minor');
            $table->char('currency', 3)->default('INR');
            $table->string('status')->default('created')->index(); // created|attempted|paid|failed|cancelled|expired
            $table->string('receipt')->nullable();
            $table->json('notes')->nullable();
            $table->string('idempotency_key')->nullable()->unique();
            $table->timestamps();
        });

        // A capture attempt against an order — maps to a Razorpay payment.
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_order_id')->nullable()->constrained('payment_orders')->nullOnDelete();
            $table->string('provider')->default('razorpay');
            $table->string('provider_payment_id')->nullable()->unique();
            $table->string('provider_order_id')->nullable()->index();
            $table->nullableMorphs('payable');
            $table->nullableMorphs('owner');
            $table->unsignedBigInteger('amount_minor');
            $table->unsignedBigInteger('amount_refunded_minor')->default(0);
            $table->char('currency', 3)->default('INR');
            $table->string('method')->nullable();       // card|upi|netbanking|wallet|cash
            $table->string('status')->default('created')->index(); // created|authorized|captured|failed|refunded|partially_refunded
            $table->timestamp('captured_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->string('error_code')->nullable();
            $table->string('error_description')->nullable();
            $table->json('notes')->nullable();
            $table->timestamps();
        });

        // Money out to a driver — maps to a Razorpay payout.
        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->string('payout_number')->unique();
            $table->string('provider')->default('razorpay');
            $table->string('provider_payout_id')->nullable()->unique();
            $table->foreignId('withdrawal_request_id')->nullable()->constrained('withdrawal_requests')->nullOnDelete();
            $table->nullableMorphs('owner');            // Driver
            $table->unsignedBigInteger('amount_minor');
            $table->char('currency', 3)->default('INR');
            $table->string('status')->default('created')->index(); // created|queued|processing|processed|reversed|failed|cancelled
            $table->string('fund_account_id')->nullable();
            $table->string('utr')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->string('error_code')->nullable();
            $table->string('error_description')->nullable();
            $table->string('idempotency_key')->nullable()->unique();
            $table->json('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payouts');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('payment_orders');
    }
};

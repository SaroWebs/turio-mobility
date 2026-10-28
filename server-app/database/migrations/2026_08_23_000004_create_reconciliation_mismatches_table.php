<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reconciliation mismatches (SKY-MRD-001 §13.3). Each row is a discrepancy the
 * daily reconciliation sweep found between our double-entry ledger, our payment
 * records, and the payment provider — surfaced for a human to resolve rather
 * than silently reconciled.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reconciliation_mismatches', function (Blueprint $table) {
            $table->id();
            $table->string('run_id')->nullable();
            // ledger_imbalance | payment_missing_ledger | payment_amount_mismatch
            // | payout_missing_ledger | payout_amount_mismatch
            // | provider_settlement_mismatch | provider_unreachable
            $table->string('type');
            $table->string('reference_type')->nullable();
            $table->string('reference_id')->nullable();
            $table->string('provider_reference')->nullable();
            $table->bigInteger('expected_minor')->nullable();
            $table->bigInteger('actual_minor')->nullable();
            $table->string('currency', 3)->default('INR');
            $table->json('details')->nullable();
            $table->string('status')->default('open'); // open | resolved | ignored
            $table->timestamp('detected_at');
            $table->timestamp('resolved_at')->nullable();
            $table->string('resolved_by')->nullable();
            $table->timestamps();

            $table->index(['status', 'detected_at']);
            $table->index(['reference_type', 'reference_id']);
            $table->index(['type', 'reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reconciliation_mismatches');
    }
};

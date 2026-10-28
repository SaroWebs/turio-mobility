<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_refunds', function (Blueprint $table) {
                $table->id();
                $table->string('refundable_type');
                $table->unsignedBigInteger('refundable_id');
                $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
                $table->foreignId('wallet_transaction_id')->nullable()->constrained('wallet_transactions')->nullOnDelete();
                $table->decimal('amount', 10, 2)->default(0);
                $table->decimal('cancellation_fee', 10, 2)->default(0);
                $table->string('method')->default('wallet');
                $table->enum('status', ['pending', 'processed', 'failed'])->default('pending');
                $table->text('reason')->nullable();
                $table->timestamp('processed_at')->nullable();
                $table->unsignedBigInteger('processed_by')->nullable();
                $table->timestamps();

                $table->index(['refundable_type', 'refundable_id']);
                $table->index(['customer_id', 'status']);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_refunds');
    }
};

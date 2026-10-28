<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledger_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();           // e.g. wallet:12, system:booking_revenue
            $table->string('name');
            $table->enum('type', ['wallet', 'system'])->index();
            $table->nullableMorphs('owner');            // owner_type, owner_id (wallet accounts)
            $table->string('currency', 3)->default('INR');
            $table->timestamps();
        });

        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->uuid('transaction_ref');            // groups the balanced pair
            $table->foreignId('ledger_account_id')->constrained('ledger_accounts')->cascadeOnDelete();
            $table->unsignedBigInteger('wallet_id')->nullable();
            $table->unsignedBigInteger('wallet_transaction_id')->nullable();
            $table->enum('direction', ['debit', 'credit']);
            $table->unsignedBigInteger('amount_minor'); // positive integer minor units (paise)
            $table->string('currency', 3)->default('INR');
            $table->string('reference_type')->nullable();
            $table->string('reference_id')->nullable();
            $table->string('description')->nullable();
            $table->timestamp('posted_at')->useCurrent();
            $table->timestamps();

            $table->index('transaction_ref');
            $table->index('wallet_id');
            $table->index('wallet_transaction_id');
            $table->index(['reference_type', 'reference_id']);
            $table->index(['ledger_account_id', 'direction']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('ledger_accounts');
    }
};

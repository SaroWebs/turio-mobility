<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_loyalty_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->integer('points'); // positive for earned, negative for redeemed
            $table->string('action'); // 'trip_completed', 'referral_bonus', 'welcome_bonus', 'redeemed'
            $table->string('reference_type')->nullable(); // 'tour_booking', 'ride_booking', 'car_rental'
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('description')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'created_at']);
        });

        Schema::create('customer_referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referrer_customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('referred_customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('referral_code', 32)->unique();
            $table->string('status', 32)->default('pending'); // pending, completed, rewarded
            $table->unsignedInteger('reward_points')->default(500); // 500 points = ₹50
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('referrer_customer_id');
            $table->index('referral_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_referrals');
        Schema::dropIfExists('customer_loyalty_points');
    }
};

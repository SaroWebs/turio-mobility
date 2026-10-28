<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('discount_type')->default('fixed');
            $table->decimal('discount_value', 10, 2);
            $table->decimal('max_discount_amount', 10, 2)->nullable();
            $table->decimal('min_order_amount', 10, 2)->default(0);
            $table->json('service_types')->nullable();
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('per_customer_limit')->default(1);
            $table->unsignedInteger('used_count')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'starts_at', 'ends_at']);
            $table->index('code');
            $table->boolean('is_deal')->default(false);
            $table->string('deal_tag')->nullable();
        });

        Schema::create('customer_coupon_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_coupon_id')->constrained('customer_coupons')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('service_type');
            $table->nullableMorphs('redeemable');
            $table->decimal('subtotal_amount', 10, 2);
            $table->decimal('discount_amount', 10, 2);
            $table->decimal('final_amount', 10, 2);
            $table->timestamp('redeemed_at')->useCurrent();
            $table->timestamps();

            $table->index(['customer_id', 'service_type']);
            $table->index(['customer_coupon_id', 'customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_coupon_redemptions');
        Schema::dropIfExists('customer_coupons');
    }
};

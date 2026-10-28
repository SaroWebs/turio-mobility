<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('car_rentals', function (Blueprint $table) {
            $table->id();
            $table->string('booking_number')->unique(); // CAR20260410XXXX
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('car_category_id')->constrained('car_categories')->restrictOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();

            // Customer snapshot
            $table->string('customer_name');
            $table->string('customer_email')->nullable();
            $table->string('customer_phone');
            $table->text('customer_address')->nullable();

            // Rental Period
            $table->date('start_date');
            $table->date('end_date');
            $table->time('start_time')->default('09:00');
            $table->time('end_time')->default('18:00');
            $table->unsignedInteger('number_of_days');

            // Pickup / Dropoff (with coordinates)
            $table->string('pickup_location');
            $table->decimal('pickup_lat', 10, 8)->nullable();
            $table->decimal('pickup_lng', 11, 8)->nullable();
            $table->string('dropoff_location')->nullable();
            $table->decimal('dropoff_lat', 10, 8)->nullable();
            $table->decimal('dropoff_lng', 11, 8)->nullable();
            $table->text('destination_details')->nullable(); // e.g. "Ooty → Kodaikanal → Munnar"

            // Live tracking (for in-progress rentals)
            $table->decimal('current_lat', 10, 8)->nullable();
            $table->decimal('current_lng', 11, 8)->nullable();
            $table->timestamp('last_location_update')->nullable();

            // Pricing
            $table->decimal('base_price', 10, 2)->default(0);
            $table->decimal('distance_km', 8, 2)->default(0);
            $table->decimal('distance_price', 10, 2)->default(0);
            $table->decimal('extras_price', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('total_price', 10, 2)->default(0);

            // Commission
            $table->decimal('commission_amount', 10, 2)->default(0);
            $table->decimal('driver_share', 10, 2)->default(0);

            // Status
            $table->enum('status', [
                'pending', 'confirmed', 'driver_assigned',
                'in_progress', 'completed', 'cancelled',
            ])->default('pending');
            $table->enum('payment_status', ['pending', 'paid', 'failed', 'refunded'])->default('pending');
            $table->string('payment_method')->default('cash');

            // Misc
            $table->text('special_requests')->nullable();
            $table->text('internal_notes')->nullable();
            $table->text('cancellation_reason')->nullable();

            // Notifications
            $table->boolean('whatsapp_notification')->default(true);
            $table->boolean('email_notification')->default(true);
            $table->boolean('sms_notification')->default(false);

            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['driver_id', 'status']);
            $table->index(['status', 'start_date']);
            $table->index('booking_number');
            $table->timestamp('cancelled_at')->nullable();
            $table->decimal('cancellation_fee', 10, 2)->default(0);
            $table->decimal('refund_amount', 10, 2)->default(0);
            $table->timestamp('refunded_at')->nullable();
            $table->index(['driver_id', 'status', 'start_date'], 'idx_cr_driver_status_start');
            $table->string('coupon_code')->nullable();
            $table->decimal('tax_amount', 12, 2)->nullable();
            $table->decimal('service_fee_amount', 12, 2)->nullable();
            $table->decimal('security_deposit', 12, 2)->nullable();
            $table->json('pricing_snapshot')->nullable();
            $table->dateTime('hold_expires_at')->nullable()->index();
            $table->decimal('actual_km', 10, 2)->nullable();
            $table->dateTime('actual_return_at')->nullable();
            $table->decimal('km_overage_charge', 10, 2)->default(0);
            $table->decimal('extra_hours_charge', 10, 2)->default(0);
            $table->decimal('surcharges', 10, 2)->default(0);
            $table->json('surcharge_items')->nullable();
            $table->decimal('settlement_total', 10, 2)->default(0);
            $table->text('settlement_notes')->nullable();
            $table->timestamp('settled_at')->nullable();
            $table->string('cancelled_by_type', 30)->nullable();
        });

        Schema::create('car_rental_extras', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_rental_id')->constrained('car_rentals')->cascadeOnDelete();
            $table->string('name');           // GPS Navigator, Child Seat, etc.
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('total_price', 10, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('car_rental_extras');
        Schema::dropIfExists('car_rentals');
    }
};

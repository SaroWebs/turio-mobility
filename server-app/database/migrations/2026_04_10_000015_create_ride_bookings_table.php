<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ride_bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_number')->unique(); // RIDE20260410XXXX
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->foreignId('car_category_id')->nullable()->constrained('car_categories')->nullOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();

            // Service type
            $table->enum('service_type', ['point_to_point', 'hourly', 'round_trip'])->default('point_to_point');

            // Customer snapshot
            $table->string('customer_name');
            $table->string('customer_email')->nullable();
            $table->string('customer_phone');
            $table->text('customer_address')->nullable();

            // Pickup
            $table->string('pickup_location');
            $table->text('pickup_address')->nullable();
            $table->decimal('pickup_lat', 10, 8)->nullable();
            $table->decimal('pickup_lng', 11, 8)->nullable();

            // Dropoff
            $table->string('dropoff_location')->nullable();
            $table->text('dropoff_address')->nullable();
            $table->decimal('dropoff_lat', 10, 8)->nullable();
            $table->decimal('dropoff_lng', 11, 8)->nullable();

            // Timing
            $table->datetime('scheduled_at');
            $table->datetime('driver_assigned_at')->nullable();
            $table->datetime('driver_arrived_at')->nullable();
            $table->datetime('started_at')->nullable();
            $table->datetime('completed_at')->nullable();
            $table->integer('estimated_duration')->nullable(); // minutes
            $table->integer('actual_duration')->nullable();    // minutes

            // Distance
            $table->decimal('estimated_distance_km', 8, 2)->nullable();
            $table->decimal('actual_distance_km', 8, 2)->nullable();

            // Fare Breakdown
            $table->decimal('base_fare', 10, 2)->default(0);
            $table->decimal('distance_fare', 10, 2)->default(0);
            $table->decimal('time_fare', 10, 2)->default(0);
            $table->decimal('waiting_fare', 10, 2)->default(0);
            $table->decimal('surge_multiplier', 4, 2)->default(1.00);
            $table->decimal('total_fare', 10, 2)->default(0);

            // Commission
            $table->decimal('commission_amount', 10, 2)->default(0);
            $table->decimal('driver_share', 10, 2)->default(0);

            // Status
            $table->enum('status', [
                'pending',
                'confirmed',
                'driver_assigned',
                'driver_arriving',
                'pickup',
                'in_transit',
                'completed',
                'cancelled',
            ])->default('pending');

            $table->enum('payment_status', ['pending', 'paid', 'failed', 'refunded'])->default('pending');
            $table->string('payment_method')->default('cash');

            // OTP ride start
            $table->string('start_ride_pin', 6)->nullable();
            $table->timestamp('start_pin_verified_at')->nullable();

            // Live tracking (latest driver position for this ride)
            $table->decimal('current_lat', 10, 8)->nullable();
            $table->decimal('current_lng', 11, 8)->nullable();
            $table->timestamp('last_location_update')->nullable();

            // Admin audit
            $table->json('last_admin_change_snapshot')->nullable();
            $table->timestamp('last_admin_changed_at')->nullable();
            $table->unsignedBigInteger('last_admin_changed_by')->nullable();

            // Extras
            $table->text('special_requests')->nullable();
            $table->text('driver_notes')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();

            // Notifications
            $table->boolean('whatsapp_notification')->default(true);
            $table->boolean('email_notification')->default(true);
            $table->boolean('sms_notification')->default(false);

            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['driver_id', 'status']);
            $table->index(['status', 'scheduled_at']);
            $table->index(['pickup_lat', 'pickup_lng']);
            $table->index(['current_lat', 'current_lng']);
            $table->index('booking_number');
            $table->decimal('cancellation_fee', 10, 2)->default(0);
            $table->decimal('refund_amount', 10, 2)->default(0);
            $table->timestamp('refunded_at')->nullable();
            $table->enum('dispatch_status', ['pending', 'offered', 'admin_queue', 'assigned', 'expired'])
                    ->default('pending')
                    ;
            $table->boolean('admin_assignable')->default(false);
            $table->timestamp('dispatch_failed_at')->nullable();
            $table->index(['dispatch_status', 'admin_assignable', 'scheduled_at'], 'idx_rb_dispatch_queue');
            $table->index(['driver_id', 'status', 'scheduled_at'], 'idx_rb_driver_status_sched');
            $table->string('coupon_code')->nullable();
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->string('ride_mode', 20)->default('private');
            $table->boolean('sharing_requested')->default(false);
            $table->string('sharing_enabled_by', 20)->nullable();
            $table->unsignedTinyInteger('reserved_seats')->default(1);
            $table->decimal('full_car_fare', 10, 2)->default(0);
            $table->decimal('sharing_discount_percent', 5, 2)->default(0);
            $table->decimal('sharing_savings', 10, 2)->default(0);
            $table->index(['service_type', 'ride_mode', 'scheduled_at'], 'ride_booking_sharing_idx');
            $table->decimal('tax_amount', 12, 2)->nullable();
            $table->decimal('service_fee_amount', 12, 2)->nullable();
            $table->timestamp('request_expires_at')->nullable()->index();
            $table->timestamp('request_closed_at')->nullable()->index();
            $table->string('request_outcome')->nullable()->index();
        });

        Schema::create('ride_booking_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ride_booking_id')->constrained('ride_bookings')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->unsignedTinyInteger('customer_rating')->nullable(); // 1-5
            $table->unsignedTinyInteger('driver_rating')->nullable();   // 1-5
            $table->text('review')->nullable();
            $table->timestamps();

            $table->index('ride_booking_id');
        });

        Schema::create('ride_booking_tips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ride_booking_id')->constrained('ride_bookings')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained('drivers')->cascadeOnDelete();
            $table->decimal('amount', 8, 2);
            $table->string('payment_method')->default('wallet');
            $table->enum('status', ['pending', 'paid', 'failed'])->default('pending');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ride_booking_tips');
        Schema::dropIfExists('ride_booking_reviews');
        Schema::dropIfExists('ride_bookings');
    }
};

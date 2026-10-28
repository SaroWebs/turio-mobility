<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tour_bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_number')->unique(); // TOUR20260410XXXX
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('tour_id')->constrained('tours')->cascadeOnDelete();
            $table->foreignId('tour_schedule_id')->nullable()->constrained('tour_schedules')->nullOnDelete();

            // Travellers
            $table->unsignedInteger('number_of_adults')->default(1);
            $table->unsignedInteger('number_of_children')->default(0);
            $table->date('travel_date'); // kept for non-schedule bookings

            // Snapshot of customer at booking time
            $table->string('customer_name');
            $table->string('customer_email')->nullable();
            $table->string('customer_phone');
            $table->text('customer_address')->nullable();

            // Pricing
            $table->decimal('price_per_adult', 10, 2)->default(0);
            $table->decimal('price_per_child', 10, 2)->default(0);
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('total_price', 10, 2)->default(0);

            // Status
            $table->enum('status', [
                'pending', 'confirmed', 'in_progress', 'completed', 'cancelled',
            ])->default('pending');
            $table->enum('payment_status', ['pending', 'partial', 'paid', 'refunded'])->default('pending');
            $table->string('payment_method')->default('cash');

            // Assignments
            $table->foreignId('assigned_guide_id')->nullable()->constrained('guides')->nullOnDelete();
            $table->foreignId('assigned_driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->foreignId('assigned_vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();

            // Extras
            $table->text('special_requests')->nullable();
            $table->text('internal_notes')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();

            // Notifications
            $table->boolean('whatsapp_notification')->default(true);
            $table->boolean('email_notification')->default(true);
            $table->boolean('sms_notification')->default(false);

            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['tour_schedule_id', 'status']);
            $table->index(['status', 'travel_date']);
            $table->index('booking_number');
            $table->decimal('current_lat', 10, 8)->nullable();
            $table->decimal('current_lng', 11, 8)->nullable();
            $table->timestamp('last_location_update')->nullable();
            $table->unsignedInteger('current_stop_index')->default(0);
            $table->decimal('cancellation_fee', 10, 2)->default(0);
            $table->decimal('refund_amount', 10, 2)->default(0);
            $table->timestamp('refunded_at')->nullable();
            $table->decimal('commission_amount', 10, 2)->default(0);
            $table->decimal('driver_share', 10, 2)->default(0);
            $table->index(['assigned_driver_id', 'status', 'travel_date'], 'idx_tb_driver_status_travel');
            $table->string('coupon_code')->nullable();
            $table->decimal('tax_amount', 12, 2)->nullable();
            $table->decimal('service_fee_amount', 12, 2)->nullable();
            $table->dateTime('hold_expires_at')->nullable()->index();
            $table->json('payment_plan')->nullable();
            $table->unsignedBigInteger('online_paid_minor')->default(0);
            $table->dateTime('settled_at')->nullable();
            $table->json('settlement_breakdown')->nullable();
            $table->integer('margin_minor')->nullable();
            $table->integer('driver_entitlement_minor')->nullable();
            $table->integer('cash_collected_minor')->nullable();
            $table->integer('net_settlement_minor')->nullable();
            $table->string('attendance_status')->nullable();
            $table->timestamp('waiting_started_at')->nullable();
            $table->timestamp('waiting_deadline_at')->nullable();
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('no_show_at')->nullable();
            $table->string('no_show_marked_by')->nullable();
            $table->string('no_show_review_status')->nullable();
        });

        Schema::create('travel_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tour_booking_id')->constrained('tour_bookings')->cascadeOnDelete();
            $table->string('status');
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
            $table->timestamps();

            $table->index('tour_booking_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('travel_statuses');
        Schema::dropIfExists('tour_bookings');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carpool_policies', function (Blueprint $t) {
            $t->id();
            $t->string('region', 64)->index();
            $t->unsignedInteger('version');
            $t->boolean('enabled')->default(false);
            $t->string('currency', 3);
            $t->json('rules');
            $t->foreignId('created_by')->nullable()->constrained('users');
            $t->timestamps();
            $t->unique(['region', 'version']);
        });
        Schema::create('carpool_rides', function (Blueprint $t) {
            $t->id();
            $t->foreignId('driver_id')->constrained();
            $t->foreignId('vehicle_id')->constrained();
            $t->foreignId('carpool_policy_id')->constrained();
            $t->string('status')->default('draft')->index();
            $t->string('origin');
            $t->string('destination');
            foreach (['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng'] as $column) {
                $t->decimal($column, 10, 7);
            }
            $t->json('meeting');
            $t->dateTime('departure_at')->index();
            $t->dateTime('ends_at');
            $t->string('timezone');
            $t->unsignedInteger('distance_m');
            $t->unsignedInteger('duration_minutes');
            $t->unsignedTinyInteger('seats');
            $t->unsignedBigInteger('price_minor');
            $t->string('currency', 3);
            $t->string('booking_mode');
            $t->json('preferences');
            $t->string('luggage');
            $t->text('notes')->nullable();
            $t->json('pricing_snapshot');
            $t->dateTime('completed_at')->nullable();
            $t->timestamps();
        });
        Schema::create('carpool_bookings', function (Blueprint $t) {
            $t->id();
            $t->foreignId('carpool_ride_id')->constrained();
            $t->morphs('passenger');
            $t->string('request_key', 100);
            $t->string('request_hash', 64);
            $t->unsignedTinyInteger('seats');
            $t->string('status')->index();
            $t->dateTime('expires_at')->nullable()->index();
            $t->string('payment_method');
            $t->string('payment_status')->default('pending');
            $t->string('refund_status')->default('none');
            $t->string('payout_status')->default('ineligible');
            $t->unsignedBigInteger('contribution_minor');
            $t->unsignedBigInteger('fee_minor');
            $t->unsignedBigInteger('total_minor');
            $t->unsignedBigInteger('refund_minor')->default(0);
            $t->string('currency', 3);
            $t->json('terms');
            $t->text('pin');
            $t->dateTime('checked_in_at')->nullable();
            $t->dateTime('reminded_at')->nullable();
            $t->dateTime('payout_eligible_at')->nullable();
            $t->string('attendance')->default('expected');
            $t->timestamps();
            $t->unique(['passenger_type', 'passenger_id', 'request_key'], 'carpool_request_unique');
        });
        Schema::create('carpool_reviews', function (Blueprint $t) {
            $t->id();
            $t->foreignId('carpool_booking_id')->constrained();
            $t->string('reviewer_key');
            $t->string('counterpart_key');
            $t->unsignedTinyInteger('rating');
            $t->text('body');
            $t->string('status')->default('published');
            $t->timestamps();
            $t->unique(['carpool_booking_id', 'reviewer_key']);
        });
        Schema::create('carpool_complaints', function (Blueprint $t) {
            $t->id();
            $t->foreignId('carpool_booking_id')->constrained();
            $t->string('reporter_key');
            $t->text('body');
            $t->string('status')->default('open');
            $t->text('resolution')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['carpool_complaints', 'carpool_reviews', 'carpool_bookings', 'carpool_rides', 'carpool_policies'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};

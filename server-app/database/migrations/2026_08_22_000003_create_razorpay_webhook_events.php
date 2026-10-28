<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Raw webhook-event store (SKY-MRD-001 §8.7, §12.2). Every provider webhook is
 * persisted verbatim before any side effect, keyed uniquely on
 * (provider, event_id) so a redelivery is a no-op. The processing job flips
 * `status` and records `attempts`/`error` for observability and reprocessing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('razorpay_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('razorpay');
            $table->string('event_id');
            $table->string('event_type')->nullable()->index();
            $table->json('payload');
            $table->string('signature')->nullable();
            $table->string('status')->default('received')->index();
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('processed_at')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'event_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('razorpay_webhook_events');
    }
};

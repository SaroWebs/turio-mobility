<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Transactional outbox for durable notifications (SKY-MRD-001 §8.9).
 *
 * A notification is written here in the SAME database transaction as the state
 * change that triggers it, so it can never be lost (committed row = guaranteed
 * delivery attempt) nor sent for a rolled-back change (row disappears with the
 * rollback). A worker (ProcessOutboxMessage) drains pending rows asynchronously
 * with retry/backoff and dead-letters after max attempts — replacing the inline
 * synchronous provider HTTP calls that used to run in the request path.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outbox_messages', function (Blueprint $table) {
            $table->id();
            $table->string('channel', 20);            // sms | whatsapp | email
            $table->string('recipient', 191);         // phone (sms/whatsapp) or email
            $table->string('subject')->nullable();    // email subject
            $table->text('body');                     // rendered message / email text
            $table->json('payload')->nullable();      // whatsapp template, email view+data
            // Optional caller-supplied key giving exactly-once enqueue (e.g.
            // "booking:ride:42:payment.paid:sms"). Nullable so ad-hoc messages
            // can skip dedup; multiple NULLs are allowed under a unique index.
            $table->string('dedup_key', 191)->nullable()->unique();
            // pending | processing | sent | skipped | failed | dead
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->unsignedInteger('max_attempts')->default(5);
            $table->timestamp('available_at')->nullable(); // earliest next delivery (backoff)
            $table->text('last_error')->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();

            // Drain query: due rows ordered by availability.
            $table->index(['status', 'available_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outbox_messages');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotency keys for create/pay endpoints (SKY-MRD-001 invariant #1,
 * FR-BOOK-01). A stored key caches the first response for a given
 * (scope, key) so a client-side retry replays the original outcome instead
 * of performing the mutation twice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            // Namespaced per authenticated owner ("App\Models\Customer:42")
            // so one user's key can never collide with another's.
            $table->string('scope', 191)->index();
            $table->string('idempotency_key');
            $table->string('method', 10);
            $table->string('path');
            $table->string('request_hash', 64); // sha256 of the request body
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->longText('response_body')->nullable();
            $table->json('response_headers')->nullable();
            $table->string('status', 20)->default('processing'); // processing | completed
            $table->timestamps();

            $table->unique(['scope', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tour_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tour_booking_id')->constrained('tour_bookings')->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('phone', 16);
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->string('otp_hash')->nullable();
            $table->timestamp('otp_expires_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('session_hash', 64)->nullable()->unique();
            $table->timestamp('session_expires_at')->nullable();
            $table->timestamps();
            $table->index(['tour_booking_id', 'phone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tour_shares');
    }
};

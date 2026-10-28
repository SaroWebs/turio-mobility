<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_verification_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_document_id')->constrained()->cascadeOnDelete();
            $table->uuid('request_id')->unique();
            $table->string('document_fingerprint', 64);
            $table->string('provider');
            $table->boolean('simulated');
            $table->string('status')->default('processing');
            $table->string('reference')->nullable();
            $table->text('message')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_verification_attempts');
    }
};

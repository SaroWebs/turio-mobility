<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_documents', function (Blueprint $table) {
            $table->text('encrypted_number')->nullable();
            $table->string('storage_disk')->default('public');
            $table->unsignedInteger('version')->default(0);
            $table->unsignedInteger('extra_attempts')->default(0);
            $table->string('verification_outcome')->default('unverified');
            $table->string('checksum', 64)->nullable();
        });
        Schema::create('driver_document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_document_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->string('file_path');
            $table->string('storage_disk');
            $table->string('checksum', 64)->nullable();
            $table->string('mime_type');
            $table->text('encrypted_number')->nullable();
            $table->date('expires_at')->nullable();
            $table->timestamp('consented_at')->nullable();
            $table->timestamp('created_at');
            $table->unique(['driver_document_id', 'version']);
        });
        Schema::create('document_requirements', function (Blueprint $table) {
            $table->id();
            $table->string('type', 60);
            $table->string('label');
            $table->string('service_category', 40);
            $table->string('level', 20);
            $table->boolean('mandatory')->default(true);
            $table->boolean('blocks_activation')->default(true);
            $table->boolean('requires_expiry')->default(false);
            $table->string('verification_method')->default('manual_or_api');
            $table->unsignedSmallInteger('max_submissions')->default(3);
            $table->boolean('enabled')->default(false);
            $table->timestamps();
            $table->unique(['type', 'service_category']);
        });
        Schema::create('driver_verification_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->restrictOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('service_category', 40);
            $table->string('status')->default('under_review');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestamps();
            $table->unique(['driver_id', 'service_category']);
        });
        Schema::create('verification_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_document_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('from_status');
            $table->string('to_status');
            $table->text('reason');
            $table->text('evidence')->nullable();
            $table->timestamp('created_at');
            $table->index(['driver_document_id', 'version']);
        });
        Schema::create('verification_appeals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_document_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->text('reason');
            $table->string('status')->default('pending');
            $table->text('resolution')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['driver_document_id', 'version']);
        });
        Schema::create('verification_notices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->string('dedup_key')->unique();
            $table->string('message');
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['verification_notices', 'verification_appeals', 'verification_reviews', 'driver_verification_cases', 'document_requirements', 'driver_document_versions'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('driver_documents', fn (Blueprint $table) => $table->dropColumn(['encrypted_number', 'storage_disk', 'version', 'extra_attempts', 'verification_outcome', 'checksum']));
    }
};

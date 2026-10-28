<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('booking_incidents')) {
            Schema::create('booking_incidents', function (Blueprint $table) {
                $table->id();
                $table->string('incidentable_type');
                $table->unsignedBigInteger('incidentable_id');
                $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
                $table->foreignId('driver_id')->nullable()->constrained('drivers')->nullOnDelete();
                $table->string('opened_by_type')->nullable();
                $table->unsignedBigInteger('opened_by_id')->nullable();
                $table->enum('type', ['no_show', 'dispute', 'safety', 'payment', 'service_quality', 'other']);
                $table->enum('severity', ['low', 'medium', 'high', 'critical'])->default('medium');
                $table->enum('status', ['open', 'under_review', 'resolved', 'dismissed'])->default('open');
                $table->string('title');
                $table->text('description')->nullable();
                $table->text('resolution')->nullable();
                $table->timestamp('reported_at')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->unsignedBigInteger('resolved_by')->nullable();
                $table->timestamps();

                $table->index(['incidentable_type', 'incidentable_id']);
                $table->index(['customer_id', 'status']);
                $table->index(['driver_id', 'status']);
                $table->index(['type', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_incidents');
    }
};

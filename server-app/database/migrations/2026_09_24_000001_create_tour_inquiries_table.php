<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tour_inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('tour_id')->constrained('tours')->cascadeOnDelete();
            $table->foreignId('tour_schedule_id')->nullable()->constrained('tour_schedules')->nullOnDelete();
            $table->string('inquiry_type', 30)->default('sold_out_waitlist'); // sold_out_waitlist, private_tour_request
            $table->string('status', 30)->default('pending'); // pending, contacted, fulfilled, cancelled
            $table->date('desired_date')->nullable();
            $table->unsignedInteger('number_of_guests')->default(1);
            $table->string('customer_name');
            $table->string('customer_phone');
            $table->string('customer_email')->nullable();
            $table->text('special_requests')->nullable();
            $table->text('operator_notes')->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();

            $table->index(['tour_id', 'status']);
            $table->index(['tour_schedule_id', 'status']);
            $table->index(['customer_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tour_inquiries');
    }
};

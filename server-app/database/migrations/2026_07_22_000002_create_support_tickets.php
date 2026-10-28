<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number')->unique();
            $table->morphs('requester');
            $table->nullableMorphs('booking');
            $table->string('category');
            $table->string('priority')->default('normal');
            $table->string('status')->default('open');
            $table->string('subject', 160);
            $table->timestamp('last_message_at');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'priority']);
        });

        Schema::create('support_ticket_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('support_ticket_id')->constrained()->cascadeOnDelete();
            $table->nullableMorphs('author');
            $table->text('body');
            $table->boolean('is_internal')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_messages');
        Schema::dropIfExists('support_tickets');
    }
};

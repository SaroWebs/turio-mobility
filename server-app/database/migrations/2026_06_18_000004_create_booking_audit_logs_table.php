<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('booking_audit_logs')) {
            Schema::create('booking_audit_logs', function (Blueprint $table) {
                $table->id();
                $table->string('auditable_type');
                $table->unsignedBigInteger('auditable_id');
                $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('action');
                $table->json('before')->nullable();
                $table->json('after')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index(['auditable_type', 'auditable_id']);
                $table->index(['admin_id', 'created_at']);
                $table->index('action');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_audit_logs');
    }
};

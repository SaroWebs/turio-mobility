<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otps', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 20);
            // type distinguishes which account table to query
            $table->enum('type', ['customer', 'driver', 'guide']);
            $table->string('code', 6);
            $table->timestamp('expires_at');
            $table->boolean('is_used')->default(false);
            $table->timestamps();

            $table->index(['phone', 'type', 'is_used']);
            $table->unsignedTinyInteger('attempts')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('otps');
    }
};

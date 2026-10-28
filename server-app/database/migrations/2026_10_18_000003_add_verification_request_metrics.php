<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_verification_attempts', function (Blueprint $table) {
            $table->unsignedInteger('duration_ms')->nullable();
            $table->boolean('chargeable')->nullable();
            $table->unsignedInteger('cost_minor')->nullable();
            $table->string('currency', 3)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('document_verification_attempts', fn (Blueprint $table) => $table->dropColumn(['duration_ms', 'chargeable', 'cost_minor', 'currency']));
    }
};

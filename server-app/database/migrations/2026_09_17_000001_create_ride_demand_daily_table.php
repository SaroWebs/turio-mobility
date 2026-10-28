<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ride_demand_daily', function (Blueprint $table) {
            $table->id();
            $table->date('day');
            $table->string('service_type');
            $table->string('outcome');
            $table->unsignedInteger('requests')->default(0);
            $table->unique(['day', 'service_type', 'outcome']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ride_demand_daily');
    }
};

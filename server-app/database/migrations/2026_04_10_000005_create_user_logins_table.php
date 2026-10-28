<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_logins', function (Blueprint $table) {
            $table->id();
            // Polymorphic: User (admin), Customer, Driver, or Guide
            $table->nullableMorphs('loginable');
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('device_type')->nullable(); // web, mobile, tablet
            $table->string('login_method')->default('password'); // password, otp
            $table->timestamp('logged_in_at')->useCurrent();
            $table->timestamp('logged_out_at')->nullable();

            $table->index('logged_in_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_logins');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cms_contents', function (Blueprint $table) {
            $table->id();
            $table->string('app', 60);
            $table->string('page', 100)->default('global');
            $table->string('section', 100);
            $table->string('key', 100);
            $table->enum('type', ['text', 'image', 'url', 'json'])->default('text');
            $table->longText('value')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['app', 'page', 'section', 'key']);
            $table->index(['app', 'is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cms_contents');
    }
};

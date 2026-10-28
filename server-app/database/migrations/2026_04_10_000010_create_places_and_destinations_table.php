<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('place_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('icon')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('places', function (Blueprint $table) {
            $table->id();
            $table->foreignId('place_category_id')->nullable()->constrained('place_categories')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->text('short_description')->nullable();
            $table->string('location')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('country')->default('India');
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedInteger('review_count')->default(0);
            $table->string('cover_image')->nullable();
            $table->json('tags')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->timestamps();

            $table->index(['is_active', 'is_featured']);
            $table->index(['city', 'state']);
            $table->string('google_place_id')->nullable();
            $table->decimal('google_rating', 3, 2)->nullable();
            $table->unsignedInteger('google_review_count')->default(0);
            $table->json('google_reviews')->nullable();
            $table->json('google_photos')->nullable();
            $table->timestamp('google_synced_at')->nullable();
            $table->json('google_details')->nullable();
        });

        Schema::create('place_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('place_id')->constrained('places')->cascadeOnDelete();
            $table->string('path');
            $table->enum('type', ['image', 'panorama', 'video'])->default('image');
            $table->string('caption')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->foreignId('uploaded_by_customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('source', 20)->default('admin');
            $table->string('approval_status', 20)->default('approved')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
        });

        Schema::create('destinations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->text('short_description')->nullable();
            $table->string('country')->default('India');
            $table->string('state')->nullable();
            $table->string('city')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->string('cover_image')->nullable();
            $table->json('gallery')->nullable();
            $table->json('highlights')->nullable();
            $table->decimal('rating', 3, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'is_featured']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('destinations');
        Schema::dropIfExists('place_media');
        Schema::dropIfExists('places');
        Schema::dropIfExists('place_categories');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tour_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('icon')->nullable(); // icon class or emoji
            $table->string('cover_image')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('tours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tour_category_id')->nullable()->constrained('tour_categories')->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->text('short_description')->nullable();
            $table->json('highlights')->nullable();     // key selling points
            $table->json('inclusions')->nullable();     // what's included
            $table->json('exclusions')->nullable();     // what's not included
            $table->json('faqs')->nullable();           // [{q:'..', a:'..'}]

            // Duration
            $table->unsignedInteger('duration_days')->default(1);
            $table->unsignedInteger('duration_nights')->default(0);

            // Group
            $table->unsignedInteger('min_group_size')->default(1);
            $table->unsignedInteger('max_group_size')->default(20);

            // Pricing
            $table->decimal('price_per_person', 10, 2)->default(0);
            $table->decimal('child_price', 10, 2)->default(0);
            $table->decimal('discount', 5, 2)->default(0); // percentage

            // Location
            $table->string('start_location')->nullable();
            $table->string('end_location')->nullable();
            $table->string('region')->nullable();        // South India, Rajasthan, etc.

            // Difficulty
            $table->enum('difficulty', ['easy', 'moderate', 'challenging', 'extreme'])->default('easy');

            // Media
            $table->string('cover_image')->nullable();
            $table->json('gallery')->nullable();

            // Availability
            $table->date('available_from')->nullable();
            $table->date('available_to')->nullable();

            // Status
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);

            $table->timestamps();

            $table->index(['is_active', 'is_featured']);
            $table->index('tour_category_id');
            $table->text('cancellation_policy')->nullable();
            $table->string('brochure_path')->nullable();
            $table->string('brochure_name')->nullable();
            $table->timestamp('brochure_uploaded_at')->nullable();
        });

        Schema::create('tour_itineraries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tour_id')->constrained('tours')->cascadeOnDelete();
            $table->unsignedInteger('day_number');
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('activities')->nullable();
            $table->string('accommodation')->nullable();
            $table->json('meals_included')->nullable(); // ['breakfast', 'lunch', 'dinner']
            $table->string('distance_km')->nullable();
            $table->timestamps();


            $table->index('tour_id');
            $table->foreignId('place_id')->nullable()->constrained('places')->nullOnDelete();
            $table->unsignedInteger('day_index')->nullable();
            $table->time('time')->nullable();
            $table->text('details')->nullable();
            $table->unsignedInteger('stop_order')->default(1);
            $table->unique(['tour_id', 'day_number', 'stop_order'], 'tour_itineraries_day_stop_unique');
            $table->index(['tour_id', 'day_number'], 'tour_itineraries_day_index');
            $table->string('start_location')->nullable();
            $table->string('end_location')->nullable();
            $table->string('travel_time')->nullable();
            $table->json('key_stops')->nullable();
            $table->json('inclusions')->nullable();
            $table->json('exclusions')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tour_itineraries');
        Schema::dropIfExists('tours');
        Schema::dropIfExists('tour_categories');
    }
};

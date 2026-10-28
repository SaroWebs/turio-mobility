<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key'); // e.g. ride.dispatch.pickup_radius_km

            // Scope columns — a row is global (both null), category-scoped, zone-scoped,
            // or category+zone-scoped. Resolution is most-specific-first (see SettingsService).
            $table->foreignId('scope_category_id')->nullable()
                ->constrained('car_categories')->cascadeOnDelete();
            $table->foreignId('scope_zone_id')->nullable()
                ->constrained('service_zones')->cascadeOnDelete();

            $table->json('value'); // typed value, cast per SettingsCatalog
            $table->timestamps();

            // Non-null scopes are fully guarded here; the all-null (global) case is
            // additionally enforced at the app layer via updateOrCreate in SettingsService.
            $table->unique(['key', 'scope_category_id', 'scope_zone_id'], 'settings_key_scope_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};

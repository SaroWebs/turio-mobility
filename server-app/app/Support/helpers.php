<?php

use App\Support\Settings\SettingsService;

if (! function_exists('setting')) {
    /**
     * Resolve an admin-configurable operational setting.
     *
     * @param  array{category_id?:int|string, zone_id?:int|string, lat?:float|string, lng?:float|string}  $context
     */
    function setting(string $key, mixed $default = null, array $context = []): mixed
    {
        return app(SettingsService::class)->get($key, $default, $context);
    }
}

<?php

namespace App\Support\Settings;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * Read path for admin-configurable settings.
 *
 * Loads every override row once (cached), then resolves each key against the
 * request context most-specific-first: category+zone > category > zone > global >
 * registry default > inline default.
 */
class SettingsService
{
    public const CACHE_KEY = 'settings.all';

    public function __construct(
        private SettingsCatalog $catalog,
        private ZoneResolver $zones,
    ) {}

    /**
     * Resolve a setting.
     *
     * @param  array{category_id?:int|string, zone_id?:int|string, lat?:float|string, lng?:float|string}  $context
     */
    public function get(string $key, mixed $default = null, array $context = []): mixed
    {
        $definition = $this->catalog->get($key);

        $categoryId = isset($context['category_id']) ? (int) $context['category_id'] : null;
        $zoneId = isset($context['zone_id']) ? (int) $context['zone_id'] : null;
        if ($zoneId === null && isset($context['lat'], $context['lng'])) {
            $zoneId = $this->zones->resolveZoneId((float) $context['lat'], (float) $context['lng']);
        }

        $best = null;
        $bestScore = -1;
        foreach ($this->all()[$key] ?? [] as $row) {
            $rowCategory = $row['scope_category_id'];
            $rowZone = $row['scope_zone_id'];

            // A null scope column is a wildcard; a set one must match the context.
            if ($rowCategory !== null && $rowCategory !== $categoryId) {
                continue;
            }
            if ($rowZone !== null && $rowZone !== $zoneId) {
                continue;
            }

            $score = ($rowCategory !== null ? 2 : 0) + ($rowZone !== null ? 1 : 0);
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $row;
            }
        }

        $value = $best !== null
            ? $best['value']
            : ($definition['default'] ?? $default);

        return $this->cast($value, $definition['type'] ?? null);
    }

    /**
     * All override rows grouped by key: [key => [ ['scope_category_id','scope_zone_id','value'], ... ]].
     */
    public function all(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if ($cached !== null) {
            return $cached;
        }

        try {
            $data = Setting::query()->get()
                ->groupBy('key')
                ->map(fn ($rows) => $rows->map(fn (Setting $s) => [
                    'scope_category_id' => $s->scope_category_id,
                    'scope_zone_id' => $s->scope_zone_id,
                    'value' => $s->value,
                ])->all())
                ->all();
        } catch (\Throwable $e) {
            // Table not migrated yet — fall back to registry defaults; don't cache the failure.
            return [];
        }

        Cache::forever(self::CACHE_KEY, $data);

        return $data;
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function cast(mixed $value, ?string $type): mixed
    {
        if ($value === null) {
            return null;
        }

        return match ($type) {
            'int' => (int) $value,
            'float', 'percent' => (float) $value,
            'bool' => (bool) $value,
            default => $value,
        };
    }
}

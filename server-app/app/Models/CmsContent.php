<?php

namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class CmsContent extends Model
{
    protected $fillable = [
        'app',
        'page',
        'section',
        'key',
        'type',
        'value',
        'metadata',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'metadata' => 'array',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function resolvedValue(): mixed
    {
        if ($this->type === 'image') {
            return MediaUrl::resolve($this->value);
        }

        if ($this->type === 'json') {
            return json_decode((string) $this->value, true) ?? [];
        }

        return $this->value;
    }

    public static function publishedPayload(string $app): array
    {
        return static::query()
            ->where('is_active', true)
            ->whereIn('app', ['common', $app])
            ->orderByRaw("CASE WHEN app = 'common' THEN 0 ELSE 1 END")
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->reduce(function (array $payload, CmsContent $content) {
                data_set(
                    $payload,
                    "{$content->page}.{$content->section}.{$content->key}",
                    $content->resolvedValue()
                );

                return $payload;
            }, []);
    }

    public static function apps(): Collection
    {
        return static::query()->select('app')->distinct()->orderBy('app')->pluck('app');
    }
}

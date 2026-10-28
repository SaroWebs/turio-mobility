<?php

namespace App\Support;

use Illuminate\Support\Str;

final class MediaUrl
{
    public static function resolve(?string $path): ?string
    {
        if (! filled($path)) {
            return null;
        }

        $path = trim($path);

        if (Str::startsWith(Str::lower($path), ['http://', 'https://'])) {
            return $path;
        }

        if (Str::startsWith($path, ['/storage/', 'storage/'])) {
            return asset('/'.ltrim($path, '/'));
        }

        return asset('storage/'.ltrim($path, '/'));
    }

    public static function isExternal(?string $path): bool
    {
        return filled($path)
            && Str::startsWith(Str::lower(trim((string) $path)), ['http://', 'https://']);
    }
}

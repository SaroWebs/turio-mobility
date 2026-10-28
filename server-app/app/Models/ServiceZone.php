<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceZone extends Model
{
    protected $fillable = [
        'name',
        'description',
        'center_lat',
        'center_lng',
        'radius_km',
        'priority',
        'is_active',
    ];

    protected $casts = [
        'center_lat' => 'float',
        'center_lng' => 'float',
        'radius_km' => 'float',
        'priority' => 'integer',
        'is_active' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saved(fn () => app(\App\Support\Settings\ZoneResolver::class)->forget());
        static::deleted(fn () => app(\App\Support\Settings\ZoneResolver::class)->forget());
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Great-circle distance in km from this zone's centre to a point.
     */
    public function distanceToKm(float $lat, float $lng): float
    {
        $earthRadius = 6371;
        $latDelta = deg2rad($lat - (float) $this->center_lat);
        $lngDelta = deg2rad($lng - (float) $this->center_lng);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad((float) $this->center_lat)) * cos(deg2rad($lat))
            * sin($lngDelta / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    public function containsPoint(float $lat, float $lng): bool
    {
        return $this->distanceToKm($lat, $lng) <= (float) $this->radius_km;
    }
}

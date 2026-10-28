<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = [
        'key',
        'scope_category_id',
        'scope_zone_id',
        'value',
    ];

    protected $casts = [
        // json cast round-trips scalars (30, 1.2, true, "INR") and the occasional
        // structured value; SettingsService applies the registry type on top.
        'value' => 'json',
        'scope_category_id' => 'integer',
        'scope_zone_id' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saved(fn () => app(\App\Support\Settings\SettingsService::class)->forget());
        static::deleted(fn () => app(\App\Support\Settings\SettingsService::class)->forget());
    }

    public function category()
    {
        return $this->belongsTo(CarCategory::class, 'scope_category_id');
    }

    public function zone()
    {
        return $this->belongsTo(ServiceZone::class, 'scope_zone_id');
    }
}

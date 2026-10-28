<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VehicleTracker extends Model
{
    protected $fillable = [
        'vehicle_id', 'device_uid', 'token_hash', 'status', 'latitude', 'longitude',
        'heading', 'speed_kmh', 'accuracy_m', 'battery_percent', 'ignition_on',
        'installed_at', 'last_ping_at', 'last_recorded_at',
    ];

    protected $hidden = ['token_hash'];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'heading' => 'decimal:2',
        'speed_kmh' => 'decimal:2',
        'accuracy_m' => 'decimal:2',
        'battery_percent' => 'integer',
        'ignition_on' => 'boolean',
        'installed_at' => 'datetime',
        'last_ping_at' => 'datetime',
        'last_recorded_at' => 'datetime',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(VehicleLocation::class);
    }

    public function isOnline(): bool
    {
        return $this->status === 'active'
            && $this->last_ping_at
            && $this->last_ping_at->greaterThan(now()->subMinutes(5));
    }
}

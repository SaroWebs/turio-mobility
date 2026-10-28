<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleLocation extends Model
{
    protected $fillable = [
        'vehicle_id', 'vehicle_tracker_id', 'sequence_number', 'latitude', 'longitude',
        'heading', 'speed_kmh', 'accuracy_m', 'battery_percent', 'ignition_on',
        'recorded_at', 'received_at', 'metadata',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'heading' => 'decimal:2',
        'speed_kmh' => 'decimal:2',
        'accuracy_m' => 'decimal:2',
        'battery_percent' => 'integer',
        'ignition_on' => 'boolean',
        'recorded_at' => 'datetime',
        'received_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function tracker(): BelongsTo
    {
        return $this->belongsTo(VehicleTracker::class, 'vehicle_tracker_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverLocation extends Model
{
    protected $table = 'driver_locations';

    protected $fillable = [
        'driver_id',
        'latitude',
        'longitude',
        'heading',
        'speed',
        'accuracy',
        'context',
        'recorded_at',
    ];

    protected $casts = [
        'recorded_at' => 'datetime',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'heading' => 'decimal:2',
        'speed' => 'decimal:2',
        'accuracy' => 'decimal:2',
    ];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RideDispatchAttempt extends Model
{
    protected $fillable = [
        'ride_booking_id',
        'driver_id',
        'score',
        'distance_km',
        'rank',
        'wave_number',
        'status',
        'offered_at',
        'responded_at',
        'expires_at',
        'decline_reason',
    ];

    protected $casts = [
        'score' => 'decimal:2',
        'distance_km' => 'decimal:2',
        'wave_number' => 'integer',
        'offered_at' => 'datetime',
        'responded_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function rideBooking(): BelongsTo
    {
        return $this->belongsTo(RideBooking::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }
}

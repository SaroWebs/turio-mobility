<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverAvailability extends Model
{
    protected $table = 'driver_availabilities';

    protected $fillable = [
        'driver_id',
        'is_available',
        'sharing_enabled',
        'sharing_seat_capacity',
        'status',
        'current_lat',
        'current_lng',
        'last_updated',
    ];

    protected $casts = [
        'is_available' => 'boolean',
        'sharing_enabled' => 'boolean',
        'sharing_seat_capacity' => 'integer',
        'current_lat' => 'decimal:8',
        'current_lng' => 'decimal:8',
        'last_updated' => 'datetime',
    ];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    public function isOnline(): bool
    {
        return $this->status !== 'offline';
    }

    public function isOnRide(): bool
    {
        return $this->status === 'on_ride';
    }

    public function isOnTour(): bool
    {
        return $this->status === 'on_tour';
    }

    public function isFree(): bool
    {
        return $this->status === 'online' && $this->is_available;
    }

    public function scopeActive($query)
    {
        return $query->where('is_available', true)
            ->where('status', 'online');
    }

    public function scopeSharing($query)
    {
        return $query->where('sharing_enabled', true);
    }

    public function scopeNearLocation($query, $lat, $lng, $radiusKm = 5)
    {
        // Haversine formula to find locations within distance
        // Using whereRaw instead of having to ensure it works with count() queries
        $haversine = '(6371 * acos(cos(radians(?)) * cos(radians(current_lat)) * cos(radians(current_lng) - radians(?)) + sin(radians(?)) * sin(radians(current_lat))))';

        return $query->select('*')
            ->selectRaw("$haversine AS distance", [$lat, $lng, $lat])
            ->whereRaw("$haversine <= ?", [$lat, $lng, $lat, $radiusKm])
            ->orderBy('distance');
    }
}

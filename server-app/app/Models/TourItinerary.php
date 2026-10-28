<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TourItinerary extends Model
{
    protected $table = 'tour_itineraries';

    protected $fillable = [
        'tour_id',
        'place_id',
        'day_number',
        'stop_order',
        'day_index',
        'time',
        'title',
        'start_location',
        'end_location',
        'description',
        'details',
        'activities',
        'accommodation',
        'meals_included',
        'distance_km',
        'travel_time',
        'key_stops',
        'inclusions',
        'exclusions',
    ];

    protected $casts = [
        'activities' => 'array',
        'meals_included' => 'array',
        'key_stops' => 'array',
        'inclusions' => 'array',
        'exclusions' => 'array',
        'day_number' => 'integer',
        'stop_order' => 'integer',
        'day_index' => 'integer',
    ];

    public function tour(): BelongsTo
    {
        return $this->belongsTo(Tour::class, 'tour_id');
    }

    public function place(): BelongsTo
    {
        return $this->belongsTo(Place::class, 'place_id');
    }

    public function getDayIndexAttribute($value): int
    {
        return (int) ($value ?? $this->day_number);
    }

    public function getDetailsAttribute($value): ?string
    {
        return $value ?? $this->description;
    }

    public function hasMeal(string $meal): bool
    {
        return in_array($meal, $this->meals_included ?? []);
    }

    public function getDayLabelAttribute(): string
    {
        return 'Day '.($this->day_index ?? $this->day_number);
    }
}

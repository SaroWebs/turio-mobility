<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelStatus extends Model
{
    protected $table = 'travel_statuses';

    protected $fillable = [
        'tour_booking_id',
        'status',
        'location',
        'notes',
        'occurred_at',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
    ];

    public function tourBooking(): BelongsTo
    {
        return $this->belongsTo(TourBooking::class, 'tour_booking_id');
    }
}

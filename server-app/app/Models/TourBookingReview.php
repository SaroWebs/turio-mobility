<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TourBookingReview extends Model
{
    protected $fillable = [
        'tour_booking_id',
        'customer_id',
        'driver_id',
        'tour_rating',
        'driver_rating',
        'review',
    ];

    public function tourBooking(): BelongsTo
    {
        return $this->belongsTo(TourBooking::class, 'tour_booking_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }
}

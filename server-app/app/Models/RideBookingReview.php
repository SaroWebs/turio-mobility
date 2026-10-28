<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RideBookingReview extends Model
{
    protected $table = 'ride_booking_reviews';

    protected $fillable = [
        'ride_booking_id',
        'customer_id',
        'driver_id',
        'customer_rating',
        'driver_rating',
        'review',
    ];

    protected $casts = [
        'customer_rating' => 'integer',
        'driver_rating' => 'integer',
    ];

    public function rideBooking(): BelongsTo
    {
        return $this->belongsTo(RideBooking::class, 'ride_booking_id');
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

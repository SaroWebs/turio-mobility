<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RideBookingTip extends Model
{
    protected $table = 'ride_booking_tips';

    protected $fillable = [
        'ride_booking_id',
        'customer_id',
        'driver_id',
        'amount',
        'payment_method',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
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

    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }
}

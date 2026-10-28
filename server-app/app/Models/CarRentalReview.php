<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarRentalReview extends Model
{
    protected $fillable = [
        'car_rental_id',
        'customer_id',
        'driver_id',
        'rental_rating',
        'driver_rating',
        'review',
    ];

    public function carRental(): BelongsTo
    {
        return $this->belongsTo(CarRental::class, 'car_rental_id');
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

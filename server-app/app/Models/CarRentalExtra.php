<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarRentalExtra extends Model
{
    protected $table = 'car_rental_extras';

    protected $fillable = [
        'car_rental_id',
        'name',
        'quantity',
        'unit_price',
        'total_price',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    public function rental(): BelongsTo
    {
        return $this->belongsTo(CarRental::class, 'car_rental_id');
    }
}

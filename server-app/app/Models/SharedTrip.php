<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SharedTrip extends Model
{
    protected $guarded = [];

    protected $casts = [
        'accepting' => 'boolean', 'allow_extension' => 'boolean',
        'stops' => 'array', 'geometry' => 'array', 'original_destination' => 'array',
        'ends_at' => 'datetime', 'original_ends_at' => 'datetime',
    ];

    public function bookings()
    {
        return $this->hasMany(RideBooking::class);
    }
}

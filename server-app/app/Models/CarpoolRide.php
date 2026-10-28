<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CarpoolRide extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['meeting' => 'array', 'preferences' => 'array', 'pricing_snapshot' => 'array', 'departure_at' => 'datetime', 'ends_at' => 'datetime', 'completed_at' => 'datetime', 'price_minor' => 'integer'];

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function bookings()
    {
        return $this->hasMany(CarpoolBooking::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CarpoolBooking extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['pin'];

    protected $casts = ['terms' => 'array', 'pin' => 'encrypted', 'expires_at' => 'datetime', 'checked_in_at' => 'datetime', 'reminded_at' => 'datetime', 'payout_eligible_at' => 'datetime'];

    public function ride()
    {
        return $this->belongsTo(CarpoolRide::class, 'carpool_ride_id');
    }

    public function passenger()
    {
        return $this->morphTo();
    }

    public function payments()
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    public function orders()
    {
        return $this->morphMany(PaymentOrder::class, 'payable');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TourShare extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['token_hash', 'otp_hash', 'session_hash', 'phone'];

    protected $casts = [
        'expires_at' => 'datetime', 'revoked_at' => 'datetime', 'verified_at' => 'datetime',
        'otp_expires_at' => 'datetime', 'sent_at' => 'datetime', 'session_expires_at' => 'datetime',
    ];

    public function booking()
    {
        return $this->belongsTo(TourBooking::class, 'tour_booking_id');
    }

    public function tripIsOpen(): bool
    {
        $booking = $this->booking;

        return $booking && in_array($booking->status, ['pending', 'confirmed', 'in_progress'], true)
            && $booking->schedule && ! in_array($booking->schedule->status, ['cancelled', 'completed'], true)
            && $booking->schedule->sharingEndsAt()->isFuture();
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Str;

class SupportTicket extends Model
{
    protected $fillable = ['ticket_number', 'requester_type', 'requester_id', 'booking_type', 'booking_id', 'category', 'priority', 'status', 'subject', 'last_message_at', 'resolved_at'];

    protected $casts = ['last_message_at' => 'datetime', 'resolved_at' => 'datetime'];

    public function requester(): MorphTo
    {
        return $this->morphTo();
    }

    public function booking(): MorphTo
    {
        return $this->morphTo();
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class);
    }

    public static function generateNumber(): string
    {
        do {
            $number = 'SUP-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
        } while (static::where('ticket_number', $number)->exists());

        return $number;
    }
}

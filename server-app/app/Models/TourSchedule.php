<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TourSchedule extends Model
{
    protected $table = 'tour_schedules';

    protected $fillable = [
        'tour_id',
        'departure_date',
        'return_date',
        'departure_time',
        'departure_point',
        'total_seats',
        'booked_seats',
        'reserved_seats',
        'price_override',
        'child_price_override',
        'status',
        'notes',
    ];

    protected $casts = [
        'departure_at' => 'datetime',
        'departure_date' => 'date',
        'return_date' => 'date',
        'price_override' => 'decimal:2',
        'child_price_override' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $schedule) {
            if (! $schedule->exists || $schedule->isDirty(['departure_date', 'departure_time'])) {
                $schedule->departure_at = \Carbon\Carbon::parse($schedule->departure_date->toDateString().' '.($schedule->departure_time ?: '00:00:00'), config('app.business_timezone', 'Asia/Kolkata'))->utc();
            }
        });
    }

    public function scopeBookable($query, int $guests = 1)
    {
        return $query->where('status', 'open')
            ->where('departure_at', '>=', now()->utc()->addHours((int) setting('tour.min_lead_time_hours', 0)))
            ->whereRaw('total_seats - booked_seats - reserved_seats >= ?', [$guests]);
    }

    public function sharingEndsAt(): \Carbon\Carbon
    {
        return \Carbon\Carbon::parse($this->return_date->toDateString(), config('app.business_timezone', 'Asia/Kolkata'))
            ->endOfDay()->utc();
    }

    public function scopeInProgressWindow($query)
    {
        $instant = now()->utc();
        $localDate = $instant->copy()->timezone(config('app.business_timezone', 'Asia/Kolkata'))->toDateString();

        return $query->whereNotIn('status', ['cancelled', 'completed'])
            ->where(function ($q) use ($instant, $localDate) {
                $q->where('departure_at', '<=', $instant)
                    // Preserve a conservative block for legacy rows awaiting UTC backfill.
                    ->orWhere(fn ($legacy) => $legacy->whereNull('departure_at')->whereDate('departure_date', '<=', $localDate));
            })
            ->whereDate('return_date', '>=', $localDate);
    }

    // ── Relationships ──────────────────────────────────────────────

    public function tour(): BelongsTo
    {
        return $this->belongsTo(Tour::class, 'tour_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(TourBooking::class, 'tour_schedule_id');
    }

    public function auditLogs(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(BookingAuditLog::class, 'auditable');
    }

    public function hasBookingHistory(): bool
    {
        return $this->bookings()->exists()
            || $this->auditLogs()->where('action', 'booking.departure_amended')->exists();
    }

    public function guideAssignments(): HasMany
    {
        return $this->hasMany(TourGuideAssignment::class, 'tour_schedule_id');
    }

    public function driverAssignments(): HasMany
    {
        return $this->hasMany(TourDriverAssignment::class, 'tour_schedule_id');
    }

    // ── Helpers ────────────────────────────────────────────────────

    public function getAvailableSeats(): int
    {
        return $this->total_seats - $this->booked_seats - $this->reserved_seats;
    }

    public function isAvailable(): bool
    {
        return $this->status === 'open' && $this->getAvailableSeats() > 0;
    }

    public function getEffectivePrice(): float
    {
        return $this->price_override ?? $this->tour->price_per_person;
    }

    public function getEffectiveChildPrice(): float
    {
        return $this->child_price_override ?? $this->tour->child_price;
    }
}

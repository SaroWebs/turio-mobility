<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TourInquiry extends Model
{
    use HasFactory;

    public const TYPE_SOLD_OUT_WAITLIST = 'sold_out_waitlist';

    public const TYPE_PRIVATE_TOUR_REQUEST = 'private_tour_request';

    public const STATUS_PENDING = 'pending';

    public const STATUS_CONTACTED = 'contacted';

    public const STATUS_FULFILLED = 'fulfilled';

    public const STATUS_CANCELLED = 'cancelled';

    protected $table = 'tour_inquiries';

    protected $fillable = [
        'customer_id',
        'tour_id',
        'tour_schedule_id',
        'inquiry_type',
        'status',
        'desired_date',
        'number_of_guests',
        'customer_name',
        'customer_phone',
        'customer_email',
        'special_requests',
        'operator_notes',
        'notified_at',
    ];

    protected $casts = [
        'desired_date' => 'date',
        'notified_at' => 'datetime',
        'number_of_guests' => 'integer',
    ];

    // ── Relationships ──────────────────────────────────────────────

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function tour(): BelongsTo
    {
        return $this->belongsTo(Tour::class, 'tour_id');
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(TourSchedule::class, 'tour_schedule_id');
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeSoldOutWaitlist(Builder $query): Builder
    {
        return $query->where('inquiry_type', self::TYPE_SOLD_OUT_WAITLIST);
    }

    public function scopePrivateTourRequest(Builder $query): Builder
    {
        return $query->where('inquiry_type', self::TYPE_PRIVATE_TOUR_REQUEST);
    }

    // ── Helpers ────────────────────────────────────────────────────

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }
}

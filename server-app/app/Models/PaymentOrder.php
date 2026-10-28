<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Intent to collect money (SKY-MRD-001 §6.1). Lifecycle:
 * created → attempted → paid | failed | cancelled | expired.
 */
class PaymentOrder extends Model
{
    public const STATUS_CREATED = 'created';

    public const STATUS_ATTEMPTED = 'attempted';

    public const STATUS_PAID = 'paid';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_EXPIRED = 'expired';

    protected $fillable = [
        'order_number',
        'provider',
        'provider_order_id',
        'payable_type',
        'payable_id',
        'owner_type',
        'owner_id',
        'amount_minor',
        'currency',
        'status',
        'receipt',
        'notes',
        'idempotency_key',
    ];

    protected $casts = [
        'amount_minor' => 'integer',
        'notes' => 'array',
    ];

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function payable(): MorphTo
    {
        return $this->morphTo();
    }

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    public function markAttempted(): void
    {
        if ($this->status === self::STATUS_CREATED) {
            $this->update(['status' => self::STATUS_ATTEMPTED]);
        }
    }

    public function markPaid(): void
    {
        if (! in_array($this->status, [self::STATUS_PAID, self::STATUS_CANCELLED, self::STATUS_EXPIRED], true)) {
            $this->update(['status' => self::STATUS_PAID]);
        }
    }

    public function markFailed(): void
    {
        if (! in_array($this->status, [self::STATUS_PAID], true)) {
            $this->update(['status' => self::STATUS_FAILED]);
        }
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }
}

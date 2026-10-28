<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * A capture attempt against a PaymentOrder (SKY-MRD-001 §6.1). Lifecycle:
 * created → authorized → captured; captured → partially_refunded → refunded;
 * any pre-capture state → failed.
 *
 * `provider_payment_id` is unique so a redelivered webhook or a retried
 * capture resolves to the same row (idempotency at the DB level).
 */
class Payment extends Model
{
    public const STATUS_CREATED = 'created';

    public const STATUS_AUTHORIZED = 'authorized';

    public const STATUS_CAPTURED = 'captured';

    public const STATUS_FAILED = 'failed';

    public const STATUS_REFUNDED = 'refunded';

    public const STATUS_PARTIALLY_REFUNDED = 'partially_refunded';

    protected $fillable = [
        'payment_order_id',
        'provider',
        'provider_payment_id',
        'provider_order_id',
        'payable_type',
        'payable_id',
        'owner_type',
        'owner_id',
        'amount_minor',
        'amount_refunded_minor',
        'currency',
        'method',
        'status',
        'captured_at',
        'failed_at',
        'error_code',
        'error_description',
        'notes',
    ];

    protected $casts = [
        'amount_minor' => 'integer',
        'amount_refunded_minor' => 'integer',
        'captured_at' => 'datetime',
        'failed_at' => 'datetime',
        'notes' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(PaymentOrder::class, 'payment_order_id');
    }

    public function payable(): MorphTo
    {
        return $this->morphTo();
    }

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    public function isCaptured(): bool
    {
        return $this->status === self::STATUS_CAPTURED;
    }

    public function isRefundable(): bool
    {
        return in_array($this->status, [self::STATUS_CAPTURED, self::STATUS_PARTIALLY_REFUNDED], true);
    }

    /** Remaining capturable-refund amount in minor units. */
    public function refundableMinor(): int
    {
        return max(0, (int) $this->amount_minor - (int) $this->amount_refunded_minor);
    }

    public function markCaptured(array $attributes = []): void
    {
        $this->forceFill(array_merge([
            'status' => self::STATUS_CAPTURED,
            'captured_at' => $this->captured_at ?? now(),
        ], $attributes))->save();
    }

    public function markFailed(?string $code = null, ?string $description = null): void
    {
        if ($this->isCaptured()) {
            return; // never regress a captured payment
        }

        $this->forceFill([
            'status' => self::STATUS_FAILED,
            'failed_at' => now(),
            'error_code' => $code,
            'error_description' => $description,
        ])->save();
    }

    /** Record a refund of the given minor amount, moving to partial/full refunded. */
    public function applyRefund(int $amountMinor): void
    {
        $refunded = min((int) $this->amount_minor, (int) $this->amount_refunded_minor + max(0, $amountMinor));

        $this->forceFill([
            'amount_refunded_minor' => $refunded,
            'status' => $refunded >= (int) $this->amount_minor
                ? self::STATUS_REFUNDED
                : self::STATUS_PARTIALLY_REFUNDED,
        ])->save();
    }
}

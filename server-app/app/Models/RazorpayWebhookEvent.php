<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A verbatim provider webhook delivery (SKY-MRD-001 §8.7). Persisted before any
 * side effect; `(provider, event_id)` is unique so redeliveries dedupe at the
 * DB level. State: received → processing → processed | ignored | failed.
 */
class RazorpayWebhookEvent extends Model
{
    public const STATUS_RECEIVED = 'received';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_PROCESSED = 'processed';

    public const STATUS_IGNORED = 'ignored';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'provider',
        'event_id',
        'event_type',
        'payload',
        'signature',
        'status',
        'attempts',
        'processed_at',
        'error',
    ];

    protected $casts = [
        'payload' => 'array',
        'attempts' => 'integer',
        'processed_at' => 'datetime',
    ];

    public function isProcessed(): bool
    {
        return in_array($this->status, [self::STATUS_PROCESSED, self::STATUS_IGNORED], true);
    }

    public function markProcessing(): void
    {
        $this->forceFill([
            'status' => self::STATUS_PROCESSING,
            'attempts' => (int) $this->attempts + 1,
        ])->save();
    }

    public function markProcessed(): void
    {
        $this->forceFill([
            'status' => self::STATUS_PROCESSED,
            'processed_at' => now(),
            'error' => null,
        ])->save();
    }

    /** Recognised event type we do not yet act on (e.g. refund/payout pending #4). */
    public function markIgnored(?string $reason = null): void
    {
        $this->forceFill([
            'status' => self::STATUS_IGNORED,
            'processed_at' => now(),
            'error' => $reason,
        ])->save();
    }

    public function markFailed(string $error): void
    {
        $this->forceFill([
            'status' => self::STATUS_FAILED,
            'error' => $error,
        ])->save();
    }
}

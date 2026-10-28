<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A single durable notification queued in the transactional outbox
 * (SKY-MRD-001 §8.9). One row == one (channel, recipient) delivery, so a
 * failed SMS never re-sends the WhatsApp beside it and each channel
 * dead-letters independently.
 *
 * @property string $channel
 * @property string $recipient
 * @property string|null $subject
 * @property string $body
 * @property array|null $payload
 * @property string|null $dedup_key
 * @property string $status
 * @property int $attempts
 * @property int $max_attempts
 * @property \Illuminate\Support\Carbon|null $available_at
 */
class OutboxMessage extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_SENT = 'sent';

    /** Provider for the channel is not configured — nothing was sent. */
    public const STATUS_SKIPPED = 'skipped';

    /** Delivery failed; awaiting retry (available_at holds the backoff). */
    public const STATUS_FAILED = 'failed';

    /** Max attempts exhausted — dead-lettered for manual inspection. */
    public const STATUS_DEAD = 'dead';

    protected $fillable = [
        'channel',
        'recipient',
        'subject',
        'body',
        'payload',
        'dedup_key',
        'status',
        'attempts',
        'max_attempts',
        'available_at',
        'last_error',
        'dispatched_at',
        'sent_at',
        'failed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'attempts' => 'integer',
        'max_attempts' => 'integer',
        'available_at' => 'datetime',
        'dispatched_at' => 'datetime',
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

    /** Rows that are ready for a delivery attempt at $now. */
    public function scopeDue(Builder $query, ?Carbon $now = null): Builder
    {
        $now ??= now();

        return $query
            ->whereIn('status', [self::STATUS_PENDING, self::STATUS_FAILED])
            ->where(function (Builder $q) use ($now) {
                $q->whereNull('available_at')->orWhere('available_at', '<=', $now);
            })
            ->orderBy('available_at')
            ->orderBy('id');
    }

    /** No further delivery attempts will be made. */
    public function isTerminal(): bool
    {
        return in_array($this->status, [self::STATUS_SENT, self::STATUS_SKIPPED, self::STATUS_DEAD], true);
    }

    public function markDispatched(): void
    {
        $this->forceFill([
            'status' => self::STATUS_PROCESSING,
            'dispatched_at' => now(),
        ])->save();
    }

    public function markSent(): void
    {
        $this->forceFill([
            'status' => self::STATUS_SENT,
            'sent_at' => now(),
            'last_error' => null,
        ])->save();
    }

    public function markSkipped(string $reason): void
    {
        $this->forceFill([
            'status' => self::STATUS_SKIPPED,
            'last_error' => $reason,
        ])->save();
    }

    /**
     * Record a failed attempt. Schedules a retry with the given backoff until
     * max attempts is reached, after which the row is dead-lettered.
     */
    public function recordFailure(string $error, int $attempts, int $backoffSeconds): void
    {
        $dead = $attempts >= $this->max_attempts;

        $this->forceFill([
            'attempts' => $attempts,
            'last_error' => $error,
            'status' => $dead ? self::STATUS_DEAD : self::STATUS_FAILED,
            'available_at' => $dead ? $this->available_at : now()->addSeconds($backoffSeconds),
            'failed_at' => now(),
        ])->save();
    }

    public function markDead(string $error): void
    {
        $this->forceFill([
            'status' => self::STATUS_DEAD,
            'last_error' => $error,
            'failed_at' => now(),
        ])->save();
    }
}

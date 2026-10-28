<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Money out to a driver (SKY-MRD-001 §6.1). Lifecycle:
 * created → queued → processing → processed; or reversed | failed | cancelled.
 *
 * `provider_payout_id` is unique so payout webhooks are idempotent.
 */
class Payout extends Model
{
    public const STATUS_CREATED = 'created';

    public const STATUS_QUEUED = 'queued';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_PROCESSED = 'processed';

    public const STATUS_REVERSED = 'reversed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'payout_number',
        'provider',
        'provider_payout_id',
        'withdrawal_request_id',
        'owner_type',
        'owner_id',
        'amount_minor',
        'currency',
        'status',
        'fund_account_id',
        'utr',
        'processed_at',
        'failed_at',
        'error_code',
        'error_description',
        'idempotency_key',
        'notes',
    ];

    protected $casts = [
        'amount_minor' => 'integer',
        'processed_at' => 'datetime',
        'failed_at' => 'datetime',
        'notes' => 'array',
    ];

    public function withdrawalRequest(): BelongsTo
    {
        return $this->belongsTo(WithdrawalRequest::class);
    }

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    public function isProcessed(): bool
    {
        return $this->status === self::STATUS_PROCESSED;
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, [
            self::STATUS_PROCESSED, self::STATUS_REVERSED, self::STATUS_FAILED, self::STATUS_CANCELLED,
        ], true);
    }

    public function markQueued(?string $providerPayoutId = null): void
    {
        $this->transitionTo(self::STATUS_QUEUED, array_filter(['provider_payout_id' => $providerPayoutId]));
    }

    public function markProcessing(): void
    {
        $this->transitionTo(self::STATUS_PROCESSING);
    }

    public function markProcessed(?string $utr = null): void
    {
        $this->transitionTo(self::STATUS_PROCESSED, array_filter([
            'utr' => $utr,
            'processed_at' => now(),
        ]));
    }

    public function markFailed(?string $code = null, ?string $description = null): void
    {
        $this->transitionTo(self::STATUS_FAILED, [
            'failed_at' => now(),
            'error_code' => $code,
            'error_description' => $description,
        ]);
    }

    public function markReversed(): void
    {
        $this->transitionTo(self::STATUS_REVERSED);
    }

    private function transitionTo(string $status, array $attributes = []): void
    {
        if ($this->isTerminal()) {
            return; // terminal payouts are immutable
        }

        $this->forceFill(array_merge(['status' => $status], $attributes))->save();
    }
}

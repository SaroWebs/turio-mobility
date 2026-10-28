<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * A discrepancy found by the reconciliation sweep (SKY-MRD-001 §13.3).
 *
 * Rows are keyed by (type, reference_type, reference_id) while open, so a
 * re-run updates the existing row rather than duplicating it. When a later run
 * finds the same reference consistent again, the open row is auto-resolved.
 */
class ReconciliationMismatch extends Model
{
    public const STATUS_OPEN = 'open';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_IGNORED = 'ignored';

    public const TYPE_LEDGER_IMBALANCE = 'ledger_imbalance';

    public const TYPE_PAYMENT_MISSING_LEDGER = 'payment_missing_ledger';

    public const TYPE_PAYMENT_AMOUNT_MISMATCH = 'payment_amount_mismatch';

    public const TYPE_PAYOUT_MISSING_LEDGER = 'payout_missing_ledger';

    public const TYPE_PAYOUT_AMOUNT_MISMATCH = 'payout_amount_mismatch';

    public const TYPE_PROVIDER_SETTLEMENT_MISMATCH = 'provider_settlement_mismatch';

    public const TYPE_PROVIDER_UNREACHABLE = 'provider_unreachable';

    protected $fillable = [
        'run_id',
        'type',
        'reference_type',
        'reference_id',
        'provider_reference',
        'expected_minor',
        'actual_minor',
        'currency',
        'details',
        'status',
        'detected_at',
        'resolved_at',
        'resolved_by',
    ];

    protected $casts = [
        'expected_minor' => 'integer',
        'actual_minor' => 'integer',
        'details' => 'array',
        'detected_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_OPEN);
    }

    public function markResolved(?string $by = null): void
    {
        $this->forceFill([
            'status' => self::STATUS_RESOLVED,
            'resolved_at' => now(),
            'resolved_by' => $by,
        ])->save();
    }
}

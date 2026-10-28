<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One leg of a balanced double-entry transaction (SKY-MRD-001 §8.6).
 *
 * Every wallet movement posts exactly two entries sharing a transaction_ref:
 * one on the wallet account and one on a system counterparty account, with
 * equal amount_minor and opposite direction, so each transaction_ref nets to
 * zero. Amounts are stored as positive integer minor units; the sign lives in
 * `direction`.
 */
class LedgerEntry extends Model
{
    protected $table = 'ledger_entries';

    protected $fillable = [
        'transaction_ref',
        'ledger_account_id',
        'wallet_id',
        'wallet_transaction_id',
        'direction',
        'amount_minor',
        'currency',
        'reference_type',
        'reference_id',
        'description',
        'posted_at',
    ];

    protected $casts = [
        'amount_minor' => 'integer',
        'posted_at' => 'datetime',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(LedgerAccount::class, 'ledger_account_id');
    }

    public function walletTransaction(): BelongsTo
    {
        return $this->belongsTo(WalletTransaction::class, 'wallet_transaction_id');
    }

    public function isCredit(): bool
    {
        return $this->direction === 'credit';
    }

    public function isDebit(): bool
    {
        return $this->direction === 'debit';
    }
}

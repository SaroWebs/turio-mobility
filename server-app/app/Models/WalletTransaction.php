<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalletTransaction extends Model
{
    protected $table = 'wallet_transactions';

    protected $fillable = [
        'wallet_id',
        'type',
        'amount',
        'amount_minor',
        'balance_before',
        'balance_before_minor',
        'balance_after',
        'balance_after_minor',
        'reference_type',
        'reference_id',
        'idempotency_key',
        'transaction_ref',
        'description',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'balance_before' => 'decimal:2',
        'balance_after' => 'decimal:2',
        'amount_minor' => 'integer',
        'balance_before_minor' => 'integer',
        'balance_after_minor' => 'integer',
    ];

    public function ledgerEntries(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(LedgerEntry::class, 'wallet_transaction_id');
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'wallet_id');
    }

    public function isCredit(): bool
    {
        return $this->type === 'credit';
    }

    public function isDebit(): bool
    {
        return $this->type === 'debit';
    }
}

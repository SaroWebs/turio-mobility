<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * A single account in the double-entry chart of accounts (SKY-MRD-001 §8.6).
 *
 * Two kinds of accounts exist:
 *  - type=wallet : one per Wallet, code "wallet:{id}", owned by a Customer/Driver.
 *  - type=system : platform clearing accounts (booking revenue, tips, refunds…).
 */
class LedgerAccount extends Model
{
    protected $table = 'ledger_accounts';

    protected $fillable = [
        'code',
        'name',
        'type',
        'owner_type',
        'owner_id',
        'currency',
    ];

    public function entries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class, 'ledger_account_id');
    }

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Signed balance in minor units derived purely from posted entries:
     * credits increase the balance, debits decrease it.
     */
    public function balanceMinor(): int
    {
        $credits = (int) $this->entries()->where('direction', 'credit')->sum('amount_minor');
        $debits = (int) $this->entries()->where('direction', 'debit')->sum('amount_minor');

        return $credits - $debits;
    }
}

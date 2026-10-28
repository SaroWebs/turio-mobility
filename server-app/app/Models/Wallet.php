<?php

namespace App\Models;

use App\Services\WalletLedgerService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Wallet extends Model
{
    protected $table = 'wallets';

    protected $fillable = [
        'owner_type',
        'owner_id',
        'balance',
        'balance_minor',
        'currency',
        'is_active',
    ];

    protected $casts = [
        'balance' => 'decimal:2',
        'balance_minor' => 'integer',
        'is_active' => 'boolean',
    ];

    // ── Relationships ──────────────────────────────────────────────

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class, 'wallet_id')->latest();
    }

    // ── Helpers ────────────────────────────────────────────────────

    public function credit(
        float $amount,
        string $description = '',
        ?string $refType = null,
        ?string $refId = null,
        ?string $idempotencyKey = null
    ): WalletTransaction {
        return app(WalletLedgerService::class)->credit($this, $amount, $description, $refType, $refId, $idempotencyKey);
    }

    public function debit(
        float $amount,
        string $description = '',
        ?string $refType = null,
        ?string $refId = null,
        ?string $idempotencyKey = null
    ): WalletTransaction {
        return app(WalletLedgerService::class)->debit($this, $amount, $description, $refType, $refId, $idempotencyKey);
    }

    public function hasSufficientBalance(float $amount): bool
    {
        return (float) $this->balance >= $amount;
    }

    public function getBalance(): float
    {
        return (float) $this->balance;
    }

    /**
     * Authoritative balance in integer minor units (paise). Falls back to the
     * decimal mirror for wallets seeded before the ledger existed.
     */
    public function getBalanceMinor(): int
    {
        return $this->balance_minor !== null
            ? (int) $this->balance_minor
            : \App\Support\Money::toMinor((float) $this->balance);
    }

    public function hasSufficientBalanceMinor(int $amountMinor): bool
    {
        return $this->getBalanceMinor() >= $amountMinor;
    }

    public function isActive(): bool
    {
        return (bool) ($this->is_active ?? true);
    }

    /**
     * Scope to find wallet for a specific owner.
     */
    public function scopeForOwner($query, $user)
    {
        return $query->where('owner_type', get_class($user))
            ->where('owner_id', $user->id);
    }

    /**
     * Scope to filter all customer wallets.
     */
    public function scopeForCustomers($query)
    {
        return $query->where('owner_type', 'App\Models\Customer');
    }

    /**
     * Scope to filter all driver wallets.
     */
    public function scopeForDrivers($query)
    {
        return $query->where('owner_type', 'App\Models\Driver');
    }
}

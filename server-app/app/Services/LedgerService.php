<?php

namespace App\Services;

use App\Models\LedgerAccount;
use App\Models\LedgerEntry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * General double-entry posting primitive (SKY-MRD-001 §8.6) for money flows
 * that are not wallet-centric — e.g. gateway capture → booking revenue, or
 * payout clearing → bank settlement. Wallet movements still go through
 * WalletLedgerService, which additionally maintains the wallet's cached balance.
 */
class LedgerService
{
    public function resolveAccount(string $code, array $attributes = []): LedgerAccount
    {
        return LedgerAccount::firstOrCreate(
            ['code' => $code],
            [
                'name' => $attributes['name'] ?? $this->defaultName($code),
                'type' => $attributes['type'] ?? (str_starts_with($code, 'wallet:') ? 'wallet' : 'system'),
                'owner_type' => $attributes['owner_type'] ?? null,
                'owner_id' => $attributes['owner_id'] ?? null,
                'currency' => $attributes['currency'] ?? 'INR',
            ]
        );
    }

    /**
     * Post a balanced pair of entries: debit $debitCode, credit $creditCode,
     * for an equal $amountMinor. Returns the shared transaction_ref.
     *
     * $meta keys: reference_type, reference_id, description, currency,
     * wallet_id, wallet_transaction_id, transaction_ref.
     */
    public function post(string $debitCode, string $creditCode, int $amountMinor, array $meta = []): string
    {
        if ($amountMinor <= 0) {
            throw new \InvalidArgumentException('Ledger amount must be greater than zero.');
        }

        return DB::transaction(function () use ($debitCode, $creditCode, $amountMinor, $meta) {
            $debit = $this->resolveAccount($debitCode);
            $credit = $this->resolveAccount($creditCode);
            $ref = $meta['transaction_ref'] ?? (string) Str::uuid();
            $currency = $meta['currency'] ?? 'INR';
            $now = now();

            foreach ([[$debit, 'debit'], [$credit, 'credit']] as [$account, $direction]) {
                LedgerEntry::create([
                    'transaction_ref' => $ref,
                    'ledger_account_id' => $account->id,
                    'wallet_id' => $account->type === 'wallet' ? ($meta['wallet_id'] ?? null) : null,
                    'wallet_transaction_id' => $meta['wallet_transaction_id'] ?? null,
                    'direction' => $direction,
                    'amount_minor' => $amountMinor,
                    'currency' => $currency,
                    'reference_type' => $meta['reference_type'] ?? null,
                    'reference_id' => $meta['reference_id'] ?? null,
                    'description' => $meta['description'] ?? null,
                    'posted_at' => $now,
                ]);
            }

            return $ref;
        });
    }

    private function defaultName(string $code): string
    {
        return ucwords(str_replace([':', '_'], ' ', $code));
    }
}

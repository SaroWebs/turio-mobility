<?php

namespace App\Services;

use App\Models\LedgerAccount;
use App\Models\LedgerEntry;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Records wallet movements as a balanced double-entry ledger in integer
 * minor units (SKY-MRD-001 §8.6, invariants #2 & #7).
 *
 * The public API still accepts float major units so existing callers do not
 * change; the amount is converted to integer paise at the boundary and never
 * used as a float thereafter. The decimal `wallets.balance` and
 * `wallet_transactions.*` columns are kept as a mirror for existing read
 * paths, while `wallets.balance_minor` + `ledger_entries` are authoritative.
 */
class WalletLedgerService
{
    public function credit(
        Wallet $wallet,
        float $amount,
        string $description = '',
        ?string $referenceType = null,
        ?string $referenceId = null,
        ?string $idempotencyKey = null
    ): WalletTransaction {
        return $this->record($wallet, 'credit', $amount, $description, $referenceType, $referenceId, $idempotencyKey);
    }

    public function debit(
        Wallet $wallet,
        float $amount,
        string $description = '',
        ?string $referenceType = null,
        ?string $referenceId = null,
        ?string $idempotencyKey = null
    ): WalletTransaction {
        return $this->record($wallet, 'debit', $amount, $description, $referenceType, $referenceId, $idempotencyKey);
    }

    private function record(
        Wallet $wallet,
        string $type,
        float $amount,
        string $description,
        ?string $referenceType,
        ?string $referenceId,
        ?string $idempotencyKey
    ): WalletTransaction {
        $amountMinor = Money::toMinor($amount);

        if ($amountMinor <= 0) {
            throw new \InvalidArgumentException('Wallet transaction amount must be greater than zero.');
        }

        return DB::transaction(function () use ($wallet, $type, $amountMinor, $description, $referenceType, $referenceId, $idempotencyKey) {
            $lockedWallet = Wallet::query()
                ->whereKey($wallet->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($idempotencyKey) {
                $existing = WalletTransaction::query()
                    ->where('wallet_id', $lockedWallet->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();

                if ($existing) {
                    $this->syncModel($wallet, $lockedWallet);

                    return $existing;
                }
            }

            if (! $lockedWallet->is_active) {
                throw new \RuntimeException('Wallet is inactive.');
            }

            $beforeMinor = $this->currentBalanceMinor($lockedWallet);
            $afterMinor = $type === 'credit'
                ? $beforeMinor + $amountMinor
                : $beforeMinor - $amountMinor;

            if ($afterMinor < 0 && $referenceType !== 'system_charge' && $referenceType !== 'platform_commission') {
                throw new \RuntimeException('Insufficient wallet balance.');
            }

            if ($type === 'debit' && $referenceType === 'driver_withdrawal'
                && $lockedWallet->owner_type === \App\Models\Driver::class) {
                app(DriverWithdrawalPolicy::class)->assertAllowed($lockedWallet, $amountMinor);
            }

            $lockedWallet->forceFill([
                'balance_minor' => $afterMinor,
                'balance' => Money::toMajor($afterMinor),
            ])->save();

            $transactionRef = (string) Str::uuid();

            $transaction = WalletTransaction::create([
                'wallet_id' => $lockedWallet->id,
                'type' => $type,
                'amount' => Money::toMajor($amountMinor),
                'amount_minor' => $amountMinor,
                'balance_before' => Money::toMajor($beforeMinor),
                'balance_before_minor' => $beforeMinor,
                'balance_after' => Money::toMajor($afterMinor),
                'balance_after_minor' => $afterMinor,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'idempotency_key' => $idempotencyKey,
                'transaction_ref' => $transactionRef,
                'description' => $description,
                'status' => 'completed',
            ]);

            $this->postDoubleEntry(
                $lockedWallet, $type, $amountMinor,
                $referenceType, $referenceId, $description,
                $transactionRef, $transaction->id
            );

            $this->syncModel($wallet, $lockedWallet);

            return $transaction;
        });
    }

    /**
     * balance_minor is authoritative once populated; fall back to the decimal
     * mirror for wallets that were seeded before the ledger existed.
     */
    private function currentBalanceMinor(Wallet $wallet): int
    {
        return $wallet->balance_minor !== null
            ? (int) $wallet->balance_minor
            : Money::toMinor((float) $wallet->balance);
    }

    /** Reflect the persisted balance back onto the caller's model instance. */
    private function syncModel(Wallet $target, Wallet $source): void
    {
        $target->forceFill([
            'balance' => $source->balance,
            'balance_minor' => $source->balance_minor,
        ]);
    }

    /**
     * Post the two balanced legs: the wallet leg follows the operation type,
     * the counterparty (system) leg is its mirror, so the transaction_ref nets
     * to zero.
     */
    private function postDoubleEntry(
        Wallet $wallet,
        string $type,
        int $amountMinor,
        ?string $referenceType,
        ?string $referenceId,
        string $description,
        string $transactionRef,
        int $walletTransactionId
    ): void {
        $walletAccount = $this->walletAccount($wallet);
        $counterAccount = $this->counterpartyAccount($referenceType);
        $currency = $wallet->currency ?? 'INR';
        $now = now();

        $legs = [
            ['account' => $walletAccount->id, 'wallet_id' => $wallet->id, 'direction' => $type],
            ['account' => $counterAccount->id, 'wallet_id' => null, 'direction' => $type === 'credit' ? 'debit' : 'credit'],
        ];

        foreach ($legs as $leg) {
            LedgerEntry::create([
                'transaction_ref' => $transactionRef,
                'ledger_account_id' => $leg['account'],
                'wallet_id' => $leg['wallet_id'],
                'wallet_transaction_id' => $walletTransactionId,
                'direction' => $leg['direction'],
                'amount_minor' => $amountMinor,
                'currency' => $currency,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'description' => $description,
                'posted_at' => $now,
            ]);
        }
    }

    private function walletAccount(Wallet $wallet): LedgerAccount
    {
        return LedgerAccount::firstOrCreate(
            ['code' => 'wallet:'.$wallet->id],
            [
                'name' => 'Wallet #'.$wallet->id,
                'type' => 'wallet',
                'owner_type' => $wallet->owner_type,
                'owner_id' => $wallet->owner_id,
                'currency' => $wallet->currency ?? 'INR',
            ]
        );
    }

    private function counterpartyAccount(?string $referenceType): LedgerAccount
    {
        [$code, $name] = $this->counterpartyFor($referenceType);

        return LedgerAccount::firstOrCreate(
            ['code' => $code],
            ['name' => $name, 'type' => 'system', 'currency' => 'INR']
        );
    }

    /**
     * Map a reference type to a system counterparty account. This only affects
     * which system account the mirror leg lands in; the pair balances
     * regardless, so unknown/null types fall back to a general clearing account.
     *
     * @return array{0:string,1:string}
     */
    private function counterpartyFor(?string $referenceType): array
    {
        $ref = strtolower(trim((string) $referenceType));

        return match (true) {
            $ref === 'razorpay_payment' => ['system:topup_source', 'Top-up source'],
            str_starts_with($ref, 'ride_tip') => ['system:tips', 'Tips clearing'],
            str_starts_with($ref, 'ride_booking'),
            str_starts_with($ref, 'tour_booking'),
            str_starts_with($ref, 'car_rental') => ['system:booking_revenue', 'Booking revenue'],
            $ref === 'system_charge',
            $ref === 'platform_commission' => ['system:commission', 'Platform Commission'],
            $ref === 'driver_earning' => ['system:driver_earnings', 'Driver earnings'],
            $ref === 'driver_withdrawal' => ['system:payout_clearing', 'Payout clearing'],
            str_contains($ref, 'refund') => ['system:refunds', 'Refunds'],
            $ref === 'manual' => ['system:adjustments', 'Manual adjustments'],
            default => ['system:general', 'General clearing'],
        };
    }
}

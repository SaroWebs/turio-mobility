<?php

namespace App\Services;

use App\Models\Wallet;
use Illuminate\Validation\ValidationException;

class DriverWithdrawalPolicy
{
    public function summary(Wallet $wallet): array
    {
        $value = config('driver_wallet.withdrawal_reserve_minor');
        $reserve = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        $configured = (is_int($value) || (is_string($value) && preg_match('/^\d+$/D', $value))) && $reserve !== false;

        // Pending withdrawal holds already debit the wallet; do not subtract them twice.
        return [
            'withdrawal_policy_configured' => $configured,
            'withdrawal_reserve_minor' => $configured ? $reserve : null,
            'withdrawable_minor' => $configured && $wallet->isActive() ? max(0, $wallet->getBalanceMinor() - $reserve) : 0,
        ];
    }

    /** Called while the ledger holds the authoritative wallet row lock. */
    public function assertAllowed(Wallet $wallet, int $amountMinor): void
    {
        $summary = $this->summary($wallet);
        if (! $summary['withdrawal_policy_configured']) {
            throw ValidationException::withMessages(['amount' => 'Driver withdrawals are unavailable until the retained balance policy is configured.']);
        }
        if ($amountMinor > $summary['withdrawable_minor']) {
            throw ValidationException::withMessages(['amount' => 'This withdrawal would use the required retained wallet balance.']);
        }
    }
}

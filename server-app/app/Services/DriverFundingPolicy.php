<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;

class DriverFundingPolicy
{
    public function eligible(Driver $driver): bool
    {
        $initial = setting('driver.minimum_topup_minor');
        $ongoing = setting('driver.dispatch_eligible_balance_minor');
        // Legacy rollout remains disabled until either funding setting is supplied in DB/catalog.
        if ($initial === null && $ongoing === null) {
            return true;
        }

        $minimum = filter_var($initial, FILTER_VALIDATE_INT);
        $threshold = filter_var($ongoing, FILTER_VALIDATE_INT);
        if ($minimum === false || $minimum <= 0 || $threshold === false || $threshold < 0 || ! $driver->funding_eligible) {
            return false;
        }

        $query = Wallet::forOwner($driver);
        if (DB::transactionLevel() > 0) {
            $query->lockForUpdate();
        }
        $wallet = $query->first();

        return $wallet && $wallet->is_active && $wallet->getBalanceMinor() >= $threshold;
    }
}

<?php

return [
    // Integer paise. No monetary policy is assumed: unset/invalid blocks new driver withdrawals.
    'withdrawal_reserve_minor' => env('DRIVER_WITHDRAWAL_RESERVE_MINOR'),
];

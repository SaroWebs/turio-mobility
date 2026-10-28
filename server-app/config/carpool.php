<?php

return [
    // Test checkout is never available in production. No market is seeded/enabled.
    'test_payments' => env('CARPOOL_TEST_PAYMENTS', false),
    'online_enabled' => env('CARPOOL_ONLINE_ENABLED', false),
    // A provider marketplace adapter must be installed before enabling online markets.
    'payout_adapter' => null,
];

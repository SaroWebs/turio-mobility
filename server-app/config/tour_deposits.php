<?php

return [
    'margin_basis_points' => env('TOUR_MARGIN_BASIS_POINTS'),
    'margin_policy_version' => env('TOUR_MARGIN_POLICY_VERSION'),
    'enabled' => env('TOUR_DEPOSITS_ENABLED', false),
    'policy_version' => env('TOUR_DEPOSIT_POLICY_VERSION'),
    'minimum_type' => env('TOUR_DEPOSIT_MINIMUM_TYPE'), // fixed or percentage
    'minimum_value' => env('TOUR_DEPOSIT_MINIMUM_VALUE'), // paise or basis points
];

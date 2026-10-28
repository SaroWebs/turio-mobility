<?php

use App\Services\DocumentVerification\SimulatedProvider;

return [
    'reminder_days' => [30, 15, 7],
    'retention_days' => env('VERIFICATION_RETENTION_DAYS'),
    'eko' => [
        'enabled' => (bool) env('EKO_VERIFICATION_ENABLED', false),
        'production' => (bool) env('EKO_PRODUCTION', false),
        'developer_key' => env('EKO_DEVELOPER_KEY'), 'access_key' => env('EKO_ACCESS_KEY'), 'initiator_id' => env('EKO_INITIATOR_ID'),
    ],
    // Replace an adapter and its type mapping when a real provider is integrated.
    'providers' => [
        'eko' => ['label' => 'Eko EPS (DL / RC)', 'adapter' => \App\Services\DocumentVerification\EkoProvider::class, 'simulated' => false],
        'simulated_transport' => ['label' => 'Transport registry (simulation)', 'adapter' => SimulatedProvider::class, 'simulated' => true],
        'simulated_identity' => ['label' => 'Identity provider (simulation)', 'adapter' => SimulatedProvider::class, 'simulated' => true],
        'simulated_background' => ['label' => 'Background checks (simulation)', 'adapter' => SimulatedProvider::class, 'simulated' => true],
    ],
    'types' => [
        'driving_license' => ['eko', 'simulated_transport'],
        'government_id' => ['simulated_identity'],
        'vehicle_rc' => ['eko', 'simulated_transport'],
        'police_verification' => ['simulated_background'],
        'tax_id' => ['simulated_identity'],
    ],
];

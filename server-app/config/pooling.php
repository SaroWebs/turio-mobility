<?php

return [
    'gps_max_age_seconds' => 45,
    'gps_max_accuracy_m' => 75,
    'corridor_m' => 300,
    'pickup_buffer_seconds' => 30,
    'max_pickup_seconds' => 900,
    'stop_seconds' => 45,
    'max_delay_seconds' => 600,
    'max_extension_m' => 15000,
    'max_extension_seconds' => 1800,
    'max_stops' => 10,
    'offer_seconds' => 45,
    'schedule_buffer_seconds' => 1800,
    // Set to an operated routing service in deployments without Google Routes.
    'osrm_url' => env('POOLING_OSRM_URL'),
];

<?php

return [

    /*
    |--------------------------------------------------------------------------
    | API Contract Version
    |--------------------------------------------------------------------------
    |
    | Surfaced in every API response's `meta.contract_version` and in
    | docs/openapi.yaml (SKY-MRD-001 §9.3). Date-based; bump only on a breaking
    | change to the response contract so clients can pin/negotiate a version.
    |
    */

    'version' => env('API_CONTRACT_VERSION', '2026-07-01'),

];

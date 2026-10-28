<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Provider Resilience (SKY-MRD-001 §13.3)
    |--------------------------------------------------------------------------
    |
    | Bounded timeouts and a circuit breaker for outbound third-party HTTP.
    | Every provider call gets an explicit connect/response timeout so a slow
    | dependency can never pin a request thread or queue worker indefinitely,
    | and repeated transport/5xx failures trip a breaker that fails fast during
    | an outage instead of piling retries onto a provider that is already down.
    |
    */

    'http' => [
        // Money path: keep a generous response budget (payment providers can be
        // slow) but never unbounded. GETs are safe to retry on a dropped
        // connection; state-changing POSTs are NOT retried here to avoid
        // double-charging (they rely on provider-side idempotency instead).
        'razorpay' => [
            'connect_timeout' => (int) env('RAZORPAY_HTTP_CONNECT_TIMEOUT', 5),
            'timeout' => (int) env('RAZORPAY_HTTP_TIMEOUT', 20),
            'get_retries' => (int) env('RAZORPAY_HTTP_GET_RETRIES', 2),
            'retry_delay_ms' => (int) env('RAZORPAY_HTTP_RETRY_DELAY_MS', 250),
        ],

        'twilio' => [
            'connect_timeout' => (int) env('TWILIO_HTTP_CONNECT_TIMEOUT', 3),
            'timeout' => (int) env('TWILIO_HTTP_TIMEOUT', 10),
        ],

        'mtalkz' => [
            'connect_timeout' => (int) env('MTALKZ_HTTP_CONNECT_TIMEOUT', 3),
            'timeout' => (int) env('MTALKZ_HTTP_TIMEOUT', 10),
        ],

        'whatsapp' => [
            'connect_timeout' => (int) env('WHATSAPP_HTTP_CONNECT_TIMEOUT', 3),
            'timeout' => (int) env('WHATSAPP_HTTP_TIMEOUT', 10),
        ],
    ],

    'circuit_breaker' => [
        // Trip after N consecutive transport/5xx failures; while open, calls
        // short-circuit for `cooldown_seconds`, then a single trial call is
        // allowed through (half-open) — success closes it, failure re-opens.
        'default' => [
            'failure_threshold' => (int) env('CIRCUIT_BREAKER_THRESHOLD', 5),
            'cooldown_seconds' => (int) env('CIRCUIT_BREAKER_COOLDOWN', 60),
        ],

        'razorpay' => [
            'failure_threshold' => (int) env('RAZORPAY_CB_THRESHOLD', 5),
            'cooldown_seconds' => (int) env('RAZORPAY_CB_COOLDOWN', 30),
        ],

        'twilio' => [
            'failure_threshold' => (int) env('TWILIO_CB_THRESHOLD', 8),
            'cooldown_seconds' => (int) env('TWILIO_CB_COOLDOWN', 60),
        ],

        'mtalkz' => [
            'failure_threshold' => (int) env('MTALKZ_CB_THRESHOLD', 8),
            'cooldown_seconds' => (int) env('MTALKZ_CB_COOLDOWN', 60),
        ],

        'whatsapp' => [
            'failure_threshold' => (int) env('WHATSAPP_CB_THRESHOLD', 8),
            'cooldown_seconds' => (int) env('WHATSAPP_CB_COOLDOWN', 60),
        ],
    ],

];

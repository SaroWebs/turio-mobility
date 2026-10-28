<?php

return [
    'testing' => ['mock_payments' => env('MOCK_PAYMENTS', false), 'mock_notifications' => env('MOCK_NOTIFICATIONS', false)],

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google_maps' => [
        'api_key' => env('GOOGLE_MAPS_API_KEY'),
        'cache_ttl_hours' => env('GOOGLE_PLACE_CACHE_TTL_HOURS', 24),
    ],

    'maps' => [
        'provider' => env('MAPS_PROVIDER', 'fallback'),
        'google_api_key' => env('GOOGLE_MAPS_API_KEY'),
        'mapbox_api_key' => env('MAPBOX_API_KEY'),
        'fallback_average_speed_kmh' => env('MAPS_FALLBACK_AVERAGE_SPEED_KMH', 28),
    ],

    'weather' => [
        'provider' => env('WEATHER_PROVIDER', 'fallback'),
        'api_key' => env('WEATHER_API_KEY'),
    ],

    'otp' => [
        'allow_dev_delivery' => env('OTP_DEV_DELIVERY', env('APP_ENV') !== 'production'),
        'mock_code' => env('OTP_MOCK_CODE', '123456'),
        'token_expiration_minutes' => env('OTP_TOKEN_EXPIRATION_MINUTES', 60 * 24 * 30),
        // Per-code incorrect-attempt cap before the OTP is burned (brute-force
        // lockout, SKY-MRD-001 §12.1). Complements the route-level throttle.
        'max_verify_attempts' => (int) env('OTP_MAX_VERIFY_ATTEMPTS', 5),
    ],

    'razorpay' => [
        'simulation' => env('PAYMENT_SIMULATION', true),
        'booking_checkout_enabled' => env('BOOKING_CHECKOUT_ENABLED', false),
        'booking_checkout_web_url' => env('BOOKING_CHECKOUT_WEB_URL'),
        'key' => env('RAZORPAY_KEY'),
        'secret' => env('RAZORPAY_SECRET'),
        'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
        'merchant_account' => env('RAZORPAY_MERCHANT_ACCOUNT'),
    ],

    'insurance' => [
        'provider_name' => env('INSURANCE_PROVIDER_NAME'),
        'provider_policy_url' => env('INSURANCE_PROVIDER_POLICY_URL'),
    ],

    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_TOKEN'),
        'from' => env('TWILIO_FROM'),
    ],

    // mTalkz is the selected SMS provider (replaces Twilio on the SMS path).
    // DLT (TRAI) compliance: senderid is the registered header, entity_id the
    // principal entity id, and templates.* the registered content-template ids.
    'mtalkz' => [
        'base_url' => env('MTALKZ_BASE_URL', 'https://msg.mtalkz.com/V2/http-api.php'),
        'api_key' => env('MTALKZ_API_KEY'),
        'sender_id' => env('MTALKZ_SENDER_ID'),
        'entity_id' => env('MTALKZ_ENTITY_ID'),
        'route' => env('MTALKZ_ROUTE', 'TRANS'),
        'templates' => [
            'otp' => env('MTALKZ_DLT_TEMPLATE_OTP'),
            'transactional' => env('MTALKZ_DLT_TEMPLATE_TRANSACTIONAL'),
        ],
    ],

    'sms' => [
        'provider' => env('SMS_PROVIDER', 'mtalkz'),
    ],

    'whatsapp' => [
        'api_url' => env('WHATSAPP_API_URL'),
        'api_key' => env('WHATSAPP_API_KEY'),
        'from' => env('WHATSAPP_FROM'),
    ],

    // Malware scanning for user uploads (SKY-MRD-001 §12.1). Driver options:
    //  - 'heuristic' (default): dependency-free EICAR + executable-magic checks.
    //  - 'clamav': stream uploads to a ClamAV daemon (clamd) via INSTREAM.
    //  - 'null': disable scanning (local/dev opt-out only).
    // fail_closed: when a configured scanner errors/is unreachable, reject the
    // upload (secure default) rather than letting an unscanned file through.
    'antivirus' => [
        'driver' => env('ANTIVIRUS_DRIVER', 'heuristic'),
        'fail_closed' => (bool) env('ANTIVIRUS_FAIL_CLOSED', true),
        'clamav' => [
            'socket' => env('CLAMAV_SOCKET'),
            'host' => env('CLAMAV_HOST', '127.0.0.1'),
            'port' => (int) env('CLAMAV_PORT', 3310),
            'timeout' => (int) env('CLAMAV_TIMEOUT', 30),
        ],
    ],

];

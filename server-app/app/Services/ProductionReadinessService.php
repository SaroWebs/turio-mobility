<?php

namespace App\Services;

class ProductionReadinessService
{
    /**
     * Return a deployment readiness report for environment, security, and provider wiring.
     *
     * The report is intentionally configuration-only so it can run safely in CI and during
     * deploy smoke checks without calling external providers.
     */
    public function report(): array
    {
        $checks = collect([
            $this->check(
                'app.environment',
                config('app.env') === 'production',
                'APP_ENV is production.',
                'Set APP_ENV=production for the live environment.',
                'critical'
            ),
            $this->check(
                'app.debug',
                config('app.debug') === false,
                'APP_DEBUG is disabled.',
                'Set APP_DEBUG=false before exposing the app publicly.',
                'critical'
            ),
            $this->check(
                'app.key',
                filled(config('app.key')),
                'APP_KEY is configured.',
                'Generate and configure a unique APP_KEY.',
                'critical'
            ),
            $this->check(
                'app.url_https',
                str_starts_with((string) config('app.url'), 'https://'),
                'APP_URL uses HTTPS.',
                'Set APP_URL to the canonical HTTPS production URL.',
                'critical'
            ),
            $this->check(
                'session.secure_cookie',
                (bool) config('session.secure') === true,
                'Secure session cookies are enabled.',
                'Set SESSION_SECURE_COOKIE=true behind HTTPS.',
                'critical'
            ),
            $this->check(
                'session.encrypted',
                (bool) config('session.encrypt') === true,
                'Session payload encryption is enabled.',
                'Set SESSION_ENCRYPT=true for production.',
                'warning'
            ),
            $this->check(
                'database.not_sqlite',
                config('database.default') !== 'sqlite',
                'Database is not SQLite.',
                'Use MySQL/PostgreSQL or another managed production database.',
                'critical'
            ),
            $this->check(
                'queue.not_sync',
                config('queue.default') !== 'sync',
                'Queue connection is asynchronous.',
                'Use database, Redis, SQS, or another worker-backed queue.',
                'critical'
            ),
            $this->check(
                'cache.not_array',
                ! in_array(config('cache.default'), ['array', 'null'], true),
                'Cache store is persistent.',
                'Use database, Redis, Memcached, DynamoDB, or another production cache.',
                'warning'
            ),
            $this->check(
                'mail.not_log',
                ! in_array(config('mail.default'), ['log', 'array'], true),
                'Transactional mailer is configured.',
                'Use SES, Postmark, Resend, Mailgun, SMTP, or another real mail provider.',
                'critical'
            ),
            $this->check(
                'otp.dev_delivery_disabled',
                config('services.otp.allow_dev_delivery') === false,
                'OTP development delivery is disabled.',
                'Set OTP_DEV_DELIVERY=false in production.',
                'critical'
            ),
            $this->check(
                'otp.sms_provider',
                app(MtalkzSmsService::class)->isConfigured(),
                'SMS OTP provider credentials are configured.',
                'Configure mTalkz (MTALKZ_API_KEY, MTALKZ_SENDER_ID) or replace the SMS driver before launch.',
                'critical'
            ),
            $this->check(
                'payments.razorpay',
                $this->hasRazorpayCredentials(),
                'Razorpay key, secret, and webhook secret are configured.',
                'Configure Razorpay live/sandbox credentials and webhook secret.',
                'critical'
            ),
            $this->check(
                'insurance.provider',
                filled(config('services.insurance.provider_name')) && filled(config('services.insurance.provider_policy_url')),
                'Insurance provider identity and policy wording URL are configured.',
                'Configure INSURANCE_PROVIDER_NAME and INSURANCE_PROVIDER_POLICY_URL before enabling insurance issuance.',
                'critical'
            ),
            $this->check(
                'maps.provider',
                config('services.maps.provider') !== 'fallback' && (
                    filled(config('services.maps.google_api_key')) || filled(config('services.maps.mapbox_api_key'))
                ),
                'Maps provider is configured.',
                'Configure Google Maps/Places/Directions or Mapbox and set MAPS_PROVIDER.',
                'critical'
            ),
            $this->check(
                'weather.provider',
                config('services.weather.provider') === 'fallback' || filled(config('services.weather.api_key')),
                'Weather provider is intentionally fallback or has an API key.',
                'Configure WEATHER_API_KEY when WEATHER_PROVIDER is not fallback.',
                'warning'
            ),
            $this->check(
                'broadcasting.live',
                ! in_array(config('broadcasting.default'), ['log', 'null'], true),
                'Realtime broadcasting is configured.',
                'Use Pusher, Reverb, Ably, Soketi, or another production realtime backend.',
                'critical'
            ),
            $this->check(
                'storage.cloud',
                config('filesystems.default') !== 'local',
                'Object storage is configured.',
                'Use S3, R2, or equivalent storage for production media.',
                'warning'
            ),
        ])->values();

        $criticalFailures = $checks
            ->where('passed', false)
            ->where('severity', 'critical')
            ->count();

        $warningFailures = $checks
            ->where('passed', false)
            ->where('severity', 'warning')
            ->count();

        return [
            'ready' => $criticalFailures === 0,
            'summary' => [
                'total' => $checks->count(),
                'passed' => $checks->where('passed', true)->count(),
                'critical_failures' => $criticalFailures,
                'warning_failures' => $warningFailures,
            ],
            'checks' => $checks->all(),
        ];
    }

    private function check(string $key, bool $passed, string $passMessage, string $failMessage, string $severity): array
    {
        return [
            'key' => $key,
            'passed' => $passed,
            'severity' => $severity,
            'message' => $passed ? $passMessage : $failMessage,
        ];
    }

    private function hasRazorpayCredentials(): bool
    {
        return filled(config('services.razorpay.key'))
            && filled(config('services.razorpay.secret'))
            && filled(config('services.razorpay.webhook_secret'));
    }
}

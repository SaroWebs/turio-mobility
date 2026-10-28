<?php

namespace App\Logging;

use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;

/**
 * Monolog processor that scrubs secrets and masks PII from log context/extra
 * (SKY-MRD-001 §12.1, §13.2 — "no secrets or raw PII in logs").
 *
 * Secret-bearing keys (otp code, passwords, tokens, signatures, api keys) are
 * replaced wholesale; contact keys (phone/email) are masked but keep a tail so
 * support can still correlate. Recurses into nested arrays. Attached only
 * outside local/testing so the dev mock-OTP log line stays readable.
 */
class RedactSensitiveData implements ProcessorInterface
{
    private const REDACTED = '[redacted]';

    /** Substrings that mark a value as a secret — replaced entirely. */
    private const SECRET_KEYS = [
        'password', 'secret', 'token', 'authorization',
        'api_key', 'apikey', 'signature', 'otp', 'code', 'session',
    ];

    /** Substrings that mark a contact value — masked, not removed. */
    private const CONTACT_KEYS = ['phone', 'mobile', 'email'];

    public function __invoke(LogRecord $record): LogRecord
    {
        // LogRecord::$context is readonly in Monolog 3, so a new record must be
        // built via with() rather than mutated in place.
        return $record->with(
            context: $this->scrub($record->context),
            extra: $this->scrub($record->extra),
        );
    }

    /** @param  array<mixed>  $data */
    public function scrub(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = $this->scrub($value);

                continue;
            }

            if (! is_string($key)) {
                continue;
            }

            if ($this->keyMatches($key, self::SECRET_KEYS)) {
                $data[$key] = self::REDACTED;

                continue;
            }

            if (is_string($value) && $this->keyMatches($key, self::CONTACT_KEYS)) {
                $data[$key] = $this->maskContact($key, $value);
            }
        }

        return $data;
    }

    /** @param  array<string>  $needles */
    private function keyMatches(string $key, array $needles): bool
    {
        $key = strtolower($key);

        foreach ($needles as $needle) {
            if (str_contains($key, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function maskContact(string $key, string $value): string
    {
        return str_contains(strtolower($key), 'email')
            ? $this->maskEmail($value)
            : $this->maskPhone($value);
    }

    private function maskPhone(string $value): string
    {
        $digits = preg_replace('/[^0-9]/', '', $value) ?? '';

        if (strlen($digits) < 4) {
            return self::REDACTED;
        }

        return str_repeat('*', strlen($digits) - 4).substr($digits, -4);
    }

    private function maskEmail(string $value): string
    {
        $at = strpos($value, '@');

        if ($at === false || $at === 0) {
            return self::REDACTED;
        }

        $name = substr($value, 0, $at);
        $domain = substr($value, $at);

        return substr($name, 0, 1).str_repeat('*', max(1, strlen($name) - 1)).$domain;
    }
}

<?php

namespace App\Services;

use App\Exceptions\ProviderUnavailableException;
use App\Support\CircuitBreaker;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * mTalkz is Turiya Mobility's selected SMS provider (SKY-MRD-001 provider selection).
 * This adapter is the single SMS transport for both OTP delivery and
 * transactional notifications, replacing the previous Twilio path.
 *
 * India TRAI/DLT compliance: every message is sent with a DLT-registered sender
 * header (`senderid`), the principal entity id (`entity_id`/PE ID) and the
 * content template id for the specific message. Template ids are passed per
 * call (e.g. the OTP template vs the generic transactional template) so callers
 * stay in control of which registered template a body maps to.
 *
 * NOTE: mTalkz exposes a simple HTTP API; the endpoint and parameter names here
 * follow its documented `http-api.php` contract and are all config-overridable
 * (config/services.php → `mtalkz`) so they can be reconciled against the live
 * account dashboard without code changes.
 */
class MtalkzSmsService
{
    private ?string $baseUrl;

    private ?string $apiKey;

    private ?string $senderId;

    private ?string $entityId;

    private string $route;

    private int $connectTimeout;

    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = config('services.mtalkz.base_url');
        $this->apiKey = config('services.mtalkz.api_key');
        $this->senderId = config('services.mtalkz.sender_id');
        $this->entityId = config('services.mtalkz.entity_id');
        $this->route = (string) config('services.mtalkz.route', 'TRANS');
        $this->connectTimeout = (int) config('resilience.http.mtalkz.connect_timeout', 3);
        $this->timeout = (int) config('resilience.http.mtalkz.timeout', 10);
    }

    /**
     * True when real, non-placeholder mTalkz credentials are present. Used by
     * the notification outbox to decide deliver-vs-skip, so demo/local installs
     * with copied example values never attempt a real send.
     */
    public function isConfigured(): bool
    {
        return $this->filledReal($this->baseUrl)
            && $this->filledReal($this->apiKey)
            && $this->filledReal($this->senderId);
    }

    /**
     * Send one SMS via mTalkz. Best-effort: returns false (never throws) so
     * callers — the OTP path and the outbox worker — can react without
     * unwinding. Time-bounded and wrapped in a circuit breaker so a provider
     * outage fails fast instead of stacking retries.
     *
     * @param  string|null  $dltTemplateId  DLT content-template id for this body
     */
    public function send(string $to, string $message, ?string $dltTemplateId = null): bool
    {
        if (! $this->isConfigured()) {
            Log::warning('mTalkz SMS credentials not configured; skipping send.');

            return false;
        }

        try {
            $response = CircuitBreaker::for('mtalkz')->run(function () use ($to, $message, $dltTemplateId) {
                $resp = Http::asForm()
                    ->connectTimeout($this->connectTimeout)
                    ->timeout($this->timeout)
                    ->post($this->baseUrl, array_filter([
                        'apikey' => $this->apiKey,
                        'senderid' => $this->senderId,
                        'number' => $this->normalizeNumber($to),
                        'text' => $message,
                        'route' => $this->route,
                        'dltentityid' => $this->entityId,
                        'dlttemplateid' => $dltTemplateId,
                        'format' => 'json',
                    ], fn ($value) => $value !== null && $value !== ''));

                if ($resp->serverError()) {
                    throw new ProviderUnavailableException("mTalkz SMS failed with status {$resp->status()}.");
                }

                return $resp;
            });

            if (! $response->successful()) {
                Log::error('mTalkz SMS rejected', [
                    'to' => $this->maskNumber($to),
                    'status' => $response->status(),
                ]);

                return false;
            }

            Log::info('SMS sent via mTalkz', ['to' => $this->maskNumber($to)]);

            return true;
        } catch (Exception $e) {
            Log::error('mTalkz SMS exception', [
                'to' => $this->maskNumber($to),
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * mTalkz expects a plain numeric MSISDN; drop a leading + and any spacing.
     * Deliberately conservative — no country-code injection, to avoid
     * double-prefixing numbers that are already in full international form.
     */
    private function normalizeNumber(string $to): string
    {
        return preg_replace('/[^0-9]/', '', $to) ?? $to;
    }

    /** Redact all but the last 4 digits for logs (no PII in logs). */
    private function maskNumber(string $to): string
    {
        $digits = preg_replace('/[^0-9]/', '', $to) ?? '';

        return $digits === '' ? '****' : str_repeat('*', max(0, strlen($digits) - 4)).substr($digits, -4);
    }

    private function filledReal(?string $value): bool
    {
        $normalized = strtolower(trim((string) $value));

        return $normalized !== ''
            && ! str_starts_with($normalized, 'your_')
            && ! str_starts_with($normalized, 'change_me')
            && ! in_array($normalized, ['example', '1234567890'], true);
    }
}

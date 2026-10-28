<?php

namespace App\Services;

use App\Models\Otp;
use Illuminate\Support\Facades\Log;

class OtpService
{
    /**
     * OTP validity in minutes.
     */
    protected int $expiryMinutes = 5;

    /**
     * Throttle: minimum seconds between OTP sends to the same phone.
     */
    protected int $throttleSeconds = 60;

    /**
     * Maximum incorrect verification attempts for a single OTP code before it is
     * burned and the caller must request a fresh one (brute-force lockout).
     */
    protected int $maxVerifyAttempts;

    public function __construct()
    {
        $this->maxVerifyAttempts = (int) config('services.otp.max_verify_attempts', 5);
    }

    /**
     * Generate and send an OTP to the given phone number with a specific account type.
     */
    public function send(string $phone, string $type): array
    {
        $mockMode = $this->devDeliveryAllowed();

        if (! $mockMode) {
            $recent = Otp::where('phone', $phone)
                ->where('type', $type)
                ->where('created_at', '>=', now()->subSeconds($this->throttleSeconds))
                ->where('is_used', false)
                ->first();

            if ($recent) {
                return [
                    'success' => false,
                    'message' => 'Please wait before requesting another OTP.',
                    'retry_after' => $this->throttleSeconds,
                    'status_code' => 429,
                ];
            }
        }

        Otp::where('phone', $phone)
            ->where('type', $type)
            ->where('is_used', false)
            ->delete();

        $code = $mockMode
            ? $this->mockCode()
            : str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);

        $otp = Otp::create([
            'phone' => $phone,
            'code' => $code,
            'type' => $type,
            'expires_at' => now()->addMinutes($this->expiryMinutes),
        ]);

        $delivery = $this->dispatch($phone, $code);

        if (! $delivery['sent']) {
            $otp->delete();

            return [
                'success' => false,
                'message' => 'OTP delivery is temporarily unavailable. Please try again later.',
                'status_code' => 503,
            ];
        }

        $response = [
            'success' => true,
            'message' => 'OTP sent successfully.',
            'expires_in' => $this->expiryMinutes * 60,
        ];

        if ($delivery['dev']) {
            $response['dev_otp'] = $code;
        }

        return $response;
    }

    /**
     * Verify an OTP code for the given phone number and type.
     */
    public function verify(string $phone, string $code, string $type): array
    {
        $otp = Otp::where('phone', $phone)
            ->where('type', $type)
            ->where('is_used', false)
            ->latest()
            ->first();

        if (! $otp) {
            return ['success' => false, 'message' => 'No OTP found. Please request a new one.'];
        }

        if ($otp->isExpired()) {
            $otp->delete();

            return ['success' => false, 'message' => 'OTP has expired. Please request a new one.'];
        }

        if ($otp->code !== $code) {
            $otp->increment('attempts');

            // Burn the code once the attempt cap is reached so a brute-force run
            // can't keep guessing against the same OTP; force a fresh request.
            if ($otp->attempts >= $this->maxVerifyAttempts) {
                $otp->update(['is_used' => true]);

                return [
                    'success' => false,
                    'message' => 'Too many incorrect attempts. Request a new code.',
                    'status_code' => 429,
                ];
            }

            return ['success' => false, 'message' => 'Invalid OTP code.'];
        }

        $otp->update(['is_used' => true]);

        return ['success' => true, 'message' => 'OTP verified successfully.'];
    }

    /**
     * Dispatch the OTP via SMS, or via dev log only outside production.
     *
     * @return array{sent: bool, dev: bool}
     */
    protected function dispatch(string $phone, string $code): array
    {
        if ($this->devDeliveryAllowed()) {
            Log::info('Mock OTP generated.', [
                'phone' => $phone,
                'code' => $code,
                'environment' => app()->environment(),
            ]);

            return ['sent' => true, 'dev' => true];
        }

        $sms = app(MtalkzSmsService::class);

        if (! $sms->isConfigured()) {
            Log::error('OTP delivery blocked because the SMS provider is not configured.', [
                'environment' => app()->environment(),
            ]);

            return ['sent' => false, 'dev' => false];
        }

        $body = "Your Turiya Mobility verification code is: {$code}. Valid for {$this->expiryMinutes} minutes.";

        $sent = $sms->send($phone, $body, config('services.mtalkz.templates.otp'));

        return ['sent' => $sent, 'dev' => false];
    }

    private function devDeliveryAllowed(): bool
    {
        return (bool) config('services.otp.allow_dev_delivery', false)
            && app()->environment('local', 'testing');
    }

    private function mockCode(): string
    {
        $code = (string) config('services.otp.mock_code', '123456');

        return preg_match('/^\d{6}$/', $code) === 1 ? $code : '123456';
    }
}

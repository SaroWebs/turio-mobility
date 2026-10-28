<?php

namespace App\Services;

use App\Exceptions\ProviderUnavailableException;
use App\Jobs\ProcessOutboxMessage;
use App\Models\OutboxMessage;
use App\Support\CircuitBreaker;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    protected ?string $whatsappApiUrl;

    protected ?string $whatsappApiKey;

    protected ?string $whatsappFrom;

    protected int $whatsappConnectTimeout;

    protected int $whatsappTimeout;

    public function __construct()
    {
        $this->whatsappApiUrl = config('services.whatsapp.api_url');
        $this->whatsappApiKey = config('services.whatsapp.api_key');
        $this->whatsappFrom = config('services.whatsapp.from');
        $this->whatsappConnectTimeout = (int) config('resilience.http.whatsapp.connect_timeout', 3);
        $this->whatsappTimeout = (int) config('resilience.http.whatsapp.timeout', 10);
    }

    /**
     * Send SMS via mTalkz — the selected provider (see {@see MtalkzSmsService}).
     *
     * The adapter is time-bounded and circuit-broken, and returns false (never
     * throws) on an unconfigured provider or a failed send, so both the inline
     * {@see notify()} path and the outbox worker can react without unwinding.
     * Transactional bodies map to the generic DLT content-template; OTP is sent
     * through {@see OtpService} with its own registered template id.
     *
     * @param  string  $to  Phone number with country code
     * @param  string  $message  SMS message content
     */
    public function sendSms(string $to, string $message): bool
    {
        return app(MtalkzSmsService::class)->send($to, $message, config('services.mtalkz.templates.transactional'));
    }

    /**
     * Send WhatsApp message via Business API
     *
     * @param  string  $to  Phone number with country code
     * @param  string  $message  Message content
     * @param  array  $templateData  Template data for structured messages
     */
    public function sendWhatsApp(string $to, string $message, array $templateData = []): bool
    {
        if (! $this->isChannelConfigured('whatsapp')) {
            Log::warning('WhatsApp API credentials not configured');

            return false;
        }

        try {
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => $to,
            ];

            // Use template if provided
            if (! empty($templateData)) {
                $payload['type'] = 'template';
                $payload['template'] = $templateData;
            } else {
                $payload['type'] = 'text';
                $payload['text'] = [
                    'preview_url' => false,
                    'body' => $message,
                ];
            }

            $response = CircuitBreaker::for('whatsapp')->run(function () use ($payload) {
                $resp = Http::withToken($this->whatsappApiKey)
                    ->connectTimeout($this->whatsappConnectTimeout)
                    ->timeout($this->whatsappTimeout)
                    ->post("{$this->whatsappApiUrl}/{$this->whatsappFrom}/messages", $payload);

                if ($resp->serverError()) {
                    throw new ProviderUnavailableException("WhatsApp send failed with status {$resp->status()}.");
                }

                return $resp;
            });

            if (! $response->successful()) {
                Log::error('WhatsApp message failed', [
                    'to' => $to,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            Log::info('WhatsApp message sent successfully', ['to' => $to]);

            return true;
        } catch (Exception $e) {
            Log::error('WhatsApp sending exception', [
                'to' => $to,
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Send email notification
     *
     * @param  string  $to  Email address
     * @param  string  $subject  Email subject
     * @param  string  $view  Blade view name
     * @param  array  $data  Data to pass to view
     */
    public function sendEmail(string $to, string $subject, string $view, array $data = []): bool
    {
        try {
            Mail::send($view, $data, function ($message) use ($to, $subject) {
                $message->to($to)
                    ->subject($subject);
            });

            Log::info('Email sent successfully', ['to' => $to]);

            return true;
        } catch (Exception $e) {
            Log::error('Email sending exception', [
                'to' => $to,
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Send notification to user via multiple channels
     *
     * @param  object  $user  User-like recipient to notify
     * @param  array  $channels  Channels to use (sms, email, whatsapp)
     * @param  array  $content  Content for each channel
     * @return array Results for each channel
     */
    public function notify(object $user, array $channels, array $content): array
    {
        $results = [];

        foreach ($channels as $channel) {
            switch ($channel) {
                case 'sms':
                    if (! empty($user->phone) && ! empty($content['sms'])) {
                        $results['sms'] = $this->sendSms($user->phone, $content['sms']);
                    }
                    break;

                case 'email':
                    if (! empty($user->email) && ! empty($content['email'])) {
                        $results['email'] = $this->sendEmail(
                            $user->email,
                            $content['subject'] ?? 'Notification from Turiya Mobility',
                            $content['email_view'] ?? 'emails.notification',
                            $content['email_data'] ?? ['notificationMessage' => $content['email']]
                        );
                    }
                    break;

                case 'whatsapp':
                    if (! empty($user->phone) && ! empty($content['whatsapp'])) {
                        $results['whatsapp'] = $this->sendWhatsApp(
                            $user->phone,
                            $content['whatsapp'],
                            $content['whatsapp_template'] ?? []
                        );
                    }
                    break;
            }
        }

        return $results;
    }

    /**
     * Durably enqueue a notification to the transactional outbox instead of
     * sending it inline (SKY-MRD-001 §8.9). One row is written per channel, in
     * the caller's current DB transaction, so the message is atomic with the
     * state change that triggered it — never lost, never sent for a rolled-back
     * change. Delivery happens asynchronously via {@see ProcessOutboxMessage}.
     *
     * Content uses the same contract as {@see notify()} (keys: sms, whatsapp,
     * email, subject, whatsapp_template, email_view, email_data).
     *
     * @param  array<int, string>  $channels
     * @param  array<string, mixed>  $content
     * @param  array{dedup_key?: string, available_at?: mixed, max_attempts?: int}  $options
     * @return array<int, OutboxMessage>
     */
    public function enqueue(object $user, array $channels, array $content, array $options = []): array
    {
        $dedupBase = $options['dedup_key'] ?? null;
        $availableAt = $options['available_at'] ?? now();
        $maxAttempts = $options['max_attempts'] ?? 5;

        $messages = [];

        foreach ($channels as $channel) {
            [$recipient, $body, $subject, $payload] = $this->resolveChannel($user, $channel, $content);

            // Nothing to deliver on this channel (mirrors notify()'s guards).
            if (empty($recipient) || empty($body)) {
                continue;
            }

            $attributes = [
                'channel' => $channel,
                'recipient' => $recipient,
                'subject' => $subject,
                'body' => $body,
                'payload' => $payload ?: null,
                'status' => OutboxMessage::STATUS_PENDING,
                'attempts' => 0,
                'max_attempts' => $maxAttempts,
                'available_at' => $availableAt,
            ];

            if ($dedupBase !== null) {
                $key = "{$dedupBase}:{$channel}";
                $message = OutboxMessage::firstOrCreate(['dedup_key' => $key], $attributes);

                // Already enqueued for this (event, channel): exactly-once.
                if (! $message->wasRecentlyCreated) {
                    $messages[] = $message;

                    continue;
                }
            } else {
                $message = OutboxMessage::create($attributes);
            }

            $messages[] = $message;
            $this->dispatchDelivery($message);
        }

        return $messages;
    }

    /**
     * Resolve the recipient, body, subject and payload for a channel.
     *
     * @param  array<string, mixed>  $content
     * @return array{0: ?string, 1: ?string, 2: ?string, 3: array<string, mixed>}
     */
    private function resolveChannel(object $user, string $channel, array $content): array
    {
        return match ($channel) {
            'sms' => [$user->phone ?? null, $content['sms'] ?? null, null, []],
            'whatsapp' => [
                $user->phone ?? null,
                $content['whatsapp'] ?? null,
                null,
                array_filter(['whatsapp_template' => $content['whatsapp_template'] ?? null]),
            ],
            'email' => [
                $user->email ?? null,
                $content['email'] ?? null,
                $content['subject'] ?? 'Notification from Turiya Mobility',
                array_filter([
                    'email_view' => $content['email_view'] ?? null,
                    'email_data' => $content['email_data'] ?? null,
                ]),
            ],
            default => [null, null, null, []],
        };
    }

    /**
     * Kick off delivery for a freshly-enqueued message. Under the sync queue
     * (tests, or a host with no worker) we deliberately do NOT deliver inline —
     * that would turn enqueue back into a blocking call and defeat the outbox.
     * Those rows wait for `outbox:drain` (scheduled) to pick them up.
     */
    private function dispatchDelivery(OutboxMessage $message): void
    {
        if (config('queue.default') === 'sync') {
            return;
        }

        ProcessOutboxMessage::dispatch($message->id)->afterCommit();
    }

    public function isChannelConfigured(string $channel): bool
    {
        return match ($channel) {
            'sms' => app(MtalkzSmsService::class)->isConfigured(),
            'whatsapp' => $this->validProviderValues([$this->whatsappApiUrl, $this->whatsappApiKey, $this->whatsappFrom]),
            'email' => filled(config('mail.default')),
            default => false,
        };
    }

    /**
     * Treat copied example credentials as unconfigured so local/demo lifecycle
     * events never attempt real provider calls with placeholder values.
     *
     * @param  array<int, string|null>  $values
     */
    private function validProviderValues(array $values): bool
    {
        foreach ($values as $value) {
            $normalized = strtolower(trim((string) $value));
            if ($normalized === ''
                || str_starts_with($normalized, 'your_')
                || str_starts_with($normalized, 'change_me')
                || in_array($normalized, ['1234567890', '+1234567890', 'example'], true)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Send ride booking confirmation notification
     */
    public function sendRideBookingConfirmation(object $user, array $bookingData): array
    {
        $smsMessage = "Turiya Mobility: Your ride has been booked! Booking #{$bookingData['booking_number']}. ".
            "Pickup: {$bookingData['pickup_location']}. ".
            "Scheduled: {$bookingData['scheduled_at']}. ".
            "Fare: ₹{$bookingData['total_fare']}";

        $whatsappMessage = "🚗 *Turiya Mobility Ride Booked!*\n\n".
            "Booking ID: {$bookingData['booking_number']}\n".
            "Pickup: {$bookingData['pickup_location']}\n".
            "Drop-off: {$bookingData['dropoff_location']}\n".
            "Scheduled: {$bookingData['scheduled_at']}\n".
            "Fare: ₹{$bookingData['total_fare']}\n\n".
            'Track your ride: '.url("/ride-booking/{$bookingData['id']}");

        return $this->enqueue($user, ['sms', 'email', 'whatsapp'], [
            'sms' => $smsMessage,
            'email' => $whatsappMessage,
            'subject' => "Ride Booking Confirmed - #{$bookingData['booking_number']}",
            'whatsapp' => $whatsappMessage,
        ]);
    }

    /**
     * Send ride status update notification
     */
    public function sendRideStatusUpdate(object $user, array $bookingData, string $status, ?string $message = null): array
    {
        $statusMessages = [
            'confirmed' => 'Your ride has been confirmed!',
            'driver_assigned' => 'A driver has been assigned to your ride.',
            'on_the_way' => 'Your driver is on the way!',
            'arrived' => 'Your driver has arrived at the pickup location.',
            'started' => 'Your ride has started. Have a safe journey!',
            'completed' => 'Your ride has been completed. Thank you for choosing Turiya Mobility!',
            'cancelled' => 'Your ride has been cancelled.',
        ];

        $statusMessage = $message ?? ($statusMessages[$status] ?? "Your ride status: {$status}");

        $smsMessage = "Turiya Mobility: {$statusMessage} Booking #{$bookingData['booking_number']}";

        return $this->enqueue($user, ['sms', 'whatsapp'], [
            'sms' => $smsMessage,
            'whatsapp' => "🚗 *Turiya Mobility Update*\n\n{$statusMessage}\n\nBooking: #{$bookingData['booking_number']}",
        ]);
    }

    /**
     * Send driver assignment notification
     */
    public function sendDriverAssignmentNotification(object $customer, object $driver, array $bookingData): array
    {
        $smsMessage = "Turiya Mobility: Driver assigned! {$driver->name} will pick you up. ".
            "Contact: {$driver->phone}. Booking #{$bookingData['booking_number']}";

        $whatsappMessage = "🚗 *Driver Assigned!*\n\n".
            "Driver: {$driver->name}\n".
            "Phone: {$driver->phone}\n".
            "Vehicle: {$bookingData['vehicle_number']}\n\n".
            "Booking: #{$bookingData['booking_number']}\n\n".
            'Your driver will arrive shortly!';

        return $this->enqueue($customer, ['sms', 'whatsapp'], [
            'sms' => $smsMessage,
            'whatsapp' => $whatsappMessage,
        ]);
    }

    /**
     * Send wallet transaction notification
     */
    public function sendWalletNotification(object $user, array $transactionData): array
    {
        $type = $transactionData['type'] ?? 'transaction';
        $amount = $transactionData['amount'] ?? 0;
        $balance = $transactionData['balance'] ?? 0;

        $smsMessage = "Turiya Mobility Wallet: {$type} of ₹{$amount}. New balance: ₹{$balance}";

        $whatsappMessage = "💰 *Turiya Mobility Wallet*\n\n".
            "Transaction: {$type}\n".
            "Amount: ₹{$amount}\n".
            "New Balance: ₹{$balance}\n\n".
            'Thank you for using Turiya Mobility!';

        return $this->enqueue($user, ['sms', 'whatsapp'], [
            'sms' => $smsMessage,
            'whatsapp' => $whatsappMessage,
        ]);
    }

    /**
     * Send OTP verification code
     */
    public function sendOtp(string $phone, string $otp): bool
    {
        $message = "Turiya Mobility: Your verification code is {$otp}. Valid for 5 minutes. Do not share with anyone.";

        return $this->sendSms($phone, $message);
    }

    /**
     * Send promotional message
     */
    public function sendPromotional(object $user, string $message, array $channels = ['sms', 'whatsapp']): array
    {
        return $this->enqueue($user, $channels, [
            'sms' => $message,
            'whatsapp' => $message,
            'subject' => 'Special Offer from Turiya Mobility!',
        ]);
    }
}

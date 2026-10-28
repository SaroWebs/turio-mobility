<?php

namespace App\Jobs;

use App\Models\OutboxMessage;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Delivers a single durable outbox notification (SKY-MRD-001 §8.9).
 *
 * The row in `outbox_messages` is the source of truth: `attempts` is tracked on
 * the row (queue-agnostic, survives redelivery), retries back off, and once
 * `max_attempts` is reached the message is dead-lettered instead of retried
 * forever. An unconfigured provider is a skip, not a failure — it never burns
 * retry budget.
 */
class ProcessOutboxMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    /**
     * Backoff between delivery attempts (seconds). The last value repeats for
     * any attempt beyond the array length.
     *
     * @var array<int, int>
     */
    public array $backoff = [60, 300, 900, 1800];

    public function __construct(public int $outboxMessageId)
    {
        $this->onQueue('notifications');
    }

    public function handle(NotificationService $notifications): void
    {
        $message = OutboxMessage::find($this->outboxMessageId);
        if (! $message || $message->isTerminal()) {
            return; // already delivered / dead-lettered / row vanished
        }

        $message->markDispatched();
        if (app()->environment('local', 'testing') && config('services.testing.mock_notifications')) {
            $message->markSkipped('simulated_delivery: inspect this outbox record; nothing sent');

            return;
        }

        // A provider that isn't configured in this environment is not a delivery
        // failure — skip without consuming the retry budget (mirrors the legacy
        // lifecycle-notification behaviour).
        if (! $notifications->isChannelConfigured($message->channel)) {
            $message->markSkipped('provider_not_configured');
            Log::warning('Outbox message skipped: provider not configured', $this->context($message));

            return;
        }

        $error = null;
        try {
            $delivered = $this->deliver($notifications, $message);
        } catch (Throwable $e) {
            $delivered = false;
            $error = $e->getMessage();
        }

        if ($delivered) {
            $message->markSent();

            return;
        }

        // Attempt count lives on the row so it advances correctly across queue
        // redeliveries and is observable/testable without a live queue.
        $attempts = $message->attempts + 1;
        $error ??= 'delivery_returned_false';
        $message->recordFailure($error, $attempts, $this->backoffFor($attempts));

        if ($message->status === OutboxMessage::STATUS_DEAD) {
            Log::error('Outbox message dead-lettered', $this->context($message, ['error' => $error]));

            return; // no throw — stop retrying
        }

        // Retry remains: throw so the queue redelivers after the backoff.
        throw new RuntimeException(
            "Outbox delivery failed for message {$message->id} on {$message->channel}: {$error}"
        );
    }

    public function failed(Throwable $exception): void
    {
        $message = OutboxMessage::find($this->outboxMessageId);
        if ($message && ! $message->isTerminal()) {
            $message->markDead($exception->getMessage());
        }

        Log::error('Outbox message job failed permanently', [
            'outbox_message_id' => $this->outboxMessageId,
            'error' => $exception->getMessage(),
        ]);
    }

    private function deliver(NotificationService $notifications, OutboxMessage $message): bool
    {
        $payload = $message->payload ?? [];

        return match ($message->channel) {
            'sms' => $notifications->sendSms($message->recipient, $message->body),
            'whatsapp' => $notifications->sendWhatsApp(
                $message->recipient,
                $message->body,
                $payload['whatsapp_template'] ?? []
            ),
            'email' => $notifications->sendEmail(
                $message->recipient,
                $message->subject ?? 'Notification from Turiya Mobility',
                $payload['email_view'] ?? 'emails.notification',
                $payload['email_data'] ?? ['notificationMessage' => $message->body]
            ),
            default => throw new RuntimeException("Unknown outbox channel: {$message->channel}"),
        };
    }

    private function backoffFor(int $attempt): int
    {
        $index = max(0, $attempt - 1);

        return $this->backoff[$index] ?? end($this->backoff);
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function context(OutboxMessage $message, array $extra = []): array
    {
        return array_merge([
            'outbox_message_id' => $message->id,
            'channel' => $message->channel,
            'attempts' => $message->attempts,
        ], $extra);
    }
}

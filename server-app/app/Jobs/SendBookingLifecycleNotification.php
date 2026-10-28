<?php

namespace App\Jobs;

use App\Models\CarRental;
use App\Models\OutboxMessage;
use App\Models\RideBooking;
use App\Models\TourBooking;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendBookingLifecycleNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /**
     * @var array<int, int>
     */
    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $bookingType,
        public int $bookingId,
        public string $action,
        public array $metadata = []
    ) {
        $this->onQueue('notifications');
    }

    public function handle(NotificationService $notifications): void
    {
        $target = $this->target();
        $recipient = $this->recipient($target);
        if (! $target || ! $recipient) {
            Log::warning('Booking notification skipped: booking or recipient missing', $this->logContext());

            return;
        }

        $content = $this->contentFor($target);
        $channels = $this->channelsFor($target, $recipient);

        // Write durable outbox rows rather than delivering inline. Delivery,
        // retry/backoff and dead-lettering are owned by ProcessOutboxMessage;
        // the dedup key makes a job redelivery enqueue each channel exactly once.
        $amendmentSuffix = $this->action === 'booking.departure_amended' ? ':'.($this->metadata['amendment_id'] ?? 'legacy') : '';
        $reminderSuffix = $this->action === 'booking.departure_reminder' ? ':'.($this->metadata['reminder_window'] ?? '24h') : '';
        $messages = $notifications->enqueue($recipient, $channels, $content, [
            'dedup_key' => "booking:{$this->bookingType}:{$this->bookingId}:{$this->action}{$amendmentSuffix}{$reminderSuffix}",
        ]);

        Log::info('Booking notification enqueued to outbox', $this->logContext([
            'channels' => array_map(fn (OutboxMessage $message) => $message->channel, $messages),
            'outbox_ids' => array_map(fn (OutboxMessage $message) => $message->id, $messages),
        ]));
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Booking notification job failed permanently', $this->logContext([
            'error' => $exception->getMessage(),
        ]));
    }

    private function target(): ?Model
    {
        return match ($this->bookingType) {
            'ride' => RideBooking::with('customer', 'driver')->find($this->bookingId),
            'tour' => TourBooking::with('customer', 'assignedDriver')->find($this->bookingId),
            'rental' => CarRental::with('customer', 'driver')->find($this->bookingId),
            'driver' => \App\Models\Driver::find($this->bookingId),
            default => null,
        };
    }

    private function recipient(?Model $target): ?object
    {
        if (! $target) {
            return null;
        }

        if ($target instanceof \App\Models\Driver) {
            return $target;
        }

        return $target->customer ?? null;
    }

    /**
     * @return array<int, string>
     */
    private function channelsFor(Model $target, object $recipient): array
    {
        if ($target instanceof \App\Models\Driver) {
            $channels = ['sms', 'whatsapp'];
            if (! empty($recipient->email)) {
                $channels[] = 'email';
            }

            return $channels;
        }

        $channels = [];

        if ($target->sms_notification ?? true) {
            $channels[] = 'sms';
        }
        if ($target->whatsapp_notification ?? true) {
            $channels[] = 'whatsapp';
        }
        if (($target->email_notification ?? false) && ! empty($recipient->email)) {
            $channels[] = 'email';
        }

        return array_values(array_unique($channels));
    }

    /**
     * @return array<string, mixed>
     */
    private function contentFor(Model $booking): array
    {
        $label = ucfirst($this->bookingType);
        $bookingNumber = $booking->booking_number ?: (string) $booking->id;
        $message = match ($this->action) {
            'booking.created' => "{$label} booking #{$bookingNumber} has been created.",
            'booking.confirmed' => "{$label} booking #{$bookingNumber} is confirmed after online payment. Check your booking for any remaining cash balance.",
            'driver.assigned' => "A driver has been assigned to {$label} booking #{$bookingNumber}.",
            'booking.accepted' => "{$label} booking #{$bookingNumber} has been accepted.",
            'booking.declined' => "{$label} booking #{$bookingNumber} has been declined.",
            'booking.started' => "{$label} booking #{$bookingNumber} has started.",
            'booking.completed' => "{$label} booking #{$bookingNumber} has been completed.",
            'booking.cancelled' => "{$label} booking #{$bookingNumber} has been cancelled.",
            'booking.departure_amended' => "{$label} booking #{$bookingNumber} has moved to departure ".($this->metadata['schedule_id'] ?? '').' on '.($this->metadata['travel_date'] ?? '').'. Your agreed price is unchanged. Check your booking for departure details.',
            'booking.departure_reminder' => "Reminder: Your {$label} booking #{$bookingNumber} departs on ".($this->metadata['travel_date'] ?? '').' at '.($this->metadata['departure_time'] ?? '').'. Departure point: '.($this->metadata['departure_point'] ?? 'standard pickup').'. Have a safe journey!',
            'payment.paid' => "Payment received for {$label} booking #{$bookingNumber}.",
            'payment.failed' => "Payment failed for {$label} booking #{$bookingNumber}.",
            'refund.processed' => "Refund processed for {$label} booking #{$bookingNumber}.",
            'rental.driver_assigned' => 'You have been assigned to Car Rental #'.($this->metadata['booking_number'] ?? $this->metadata['rental_id'] ?? '').' from '.($this->metadata['start_date'] ?? '').' to '.($this->metadata['end_date'] ?? '').'. Pickup: '.($this->metadata['pickup_location'] ?? '').'.',
            default => "{$label} booking #{$bookingNumber} update: {$this->action}.",
        };

        return [
            'sms' => 'Turiya Mobility: '.$message,
            'whatsapp' => "*Turiya Mobility Update*\n\n".$message,
            'email' => $message,
            'subject' => "Turiya Mobility {$label} Booking Update",
        ];
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function logContext(array $extra = []): array
    {
        return array_merge([
            'booking_type' => $this->bookingType,
            'booking_id' => $this->bookingId,
            'action' => $this->action,
            'metadata' => $this->metadata,
        ], $extra);
    }
}

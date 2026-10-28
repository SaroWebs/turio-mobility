<?php

namespace App\Listeners;

use App\Events\BookingLifecycleNotification;
use App\Jobs\SendBookingLifecycleNotification;
use Illuminate\Support\Facades\Log;
use Throwable;

class QueueBookingLifecycleNotification
{
    public function handle(BookingLifecycleNotification $event): void
    {
        try {
            $job = new SendBookingLifecycleNotification(
                $event->bookingType,
                $event->bookingId,
                $event->action,
                $event->metadata
            );

            if (config('queue.default') === 'sync') {
                dispatch($job);

                return;
            }

            dispatch($job)->afterCommit();
        } catch (Throwable $exception) {
            Log::error('Booking notification dispatch failed', [
                'booking_type' => $event->bookingType,
                'booking_id' => $event->bookingId,
                'action' => $event->action,
                'metadata' => $event->metadata,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}

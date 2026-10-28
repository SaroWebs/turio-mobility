<?php

namespace App\Services;

use App\Events\BookingLifecycleNotification;
use App\Models\CarRental;
use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\TourBooking;
use Illuminate\Database\Eloquent\Model;

class BookingLifecycleNotifier
{
    public function emit(Model $booking, string $action, array $metadata = []): void
    {
        $type = $this->typeFor($booking);
        if (! $type || ! $booking->getKey()) {
            return;
        }

        event(new BookingLifecycleNotification($type, (int) $booking->getKey(), $action, $metadata));
    }

    private function typeFor(Model $booking): ?string
    {
        return match (true) {
            $booking instanceof RideBooking => 'ride',
            $booking instanceof TourBooking => 'tour',
            $booking instanceof CarRental => 'rental',
            $booking instanceof Driver => 'driver',
            default => null,
        };
    }
}

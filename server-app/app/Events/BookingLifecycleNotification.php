<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BookingLifecycleNotification
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public string $bookingType,
        public int $bookingId,
        public string $action,
        public array $metadata = []
    ) {}
}

<?php

namespace App\Events;

use App\Models\TourBooking;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TourLocationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public TourBooking $booking,
        public float $latitude,
        public float $longitude,
        public ?int $currentStopIndex = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('tour.'.$this->booking->id)];
    }

    public function broadcastAs(): string
    {
        return 'tour.location_updated';
    }

    public function broadcastWith(): array
    {
        return [
            'booking_id' => $this->booking->id,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'current_stop_index' => $this->currentStopIndex,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}

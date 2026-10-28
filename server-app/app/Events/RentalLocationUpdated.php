<?php

namespace App\Events;

use App\Models\CarRental;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RentalLocationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public CarRental $rental,
        public float $latitude,
        public float $longitude,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('rental.'.$this->rental->id)];
    }

    public function broadcastAs(): string
    {
        return 'rental.location_updated';
    }

    public function broadcastWith(): array
    {
        return [
            'rental_id' => $this->rental->id,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}

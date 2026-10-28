<?php

namespace App\Events;

use App\Models\RideBooking;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RideLocationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public RideBooking $booking;

    public float $latitude;

    public float $longitude;

    public ?string $status;

    public ?int $eta;

    /**
     * Create a new event instance.
     */
    public function __construct(
        RideBooking $booking,
        float $latitude,
        float $longitude,
        ?string $status = null,
        ?int $eta = null
    ) {
        $this->booking = $booking;
        $this->latitude = $latitude;
        $this->longitude = $longitude;
        $this->status = $status;
        $this->eta = $eta;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("ride.{$this->booking->id}"),
            new PrivateChannel("user.{$this->booking->user_id}.rides"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'location.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'booking_id' => $this->booking->id,
            'booking_number' => $this->booking->booking_number,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'status' => $this->status ?? $this->booking->status,
            'eta' => $this->eta,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}

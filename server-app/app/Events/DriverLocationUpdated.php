<?php

namespace App\Events;

use App\Models\Driver;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DriverLocationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Driver $driver;

    public float $latitude;

    public float $longitude;

    public bool $isAvailable;

    /**
     * Create a new event instance.
     */
    public function __construct(
        Driver $driver,
        float $latitude,
        float $longitude,
        bool $isAvailable = true
    ) {
        $this->driver = $driver;
        $this->latitude = $latitude;
        $this->longitude = $longitude;
        $this->isAvailable = $isAvailable;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("driver.{$this->driver->id}.location"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'driver.location';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'driver_id' => $this->driver->id,
            'driver_name' => $this->driver->name,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'is_available' => $this->isAvailable,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}

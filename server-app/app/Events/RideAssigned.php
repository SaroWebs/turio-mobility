<?php

namespace App\Events;

use App\Models\RideBooking;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RideAssigned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public RideBooking $booking,
        public int $driverId,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("driver.{$this->driverId}"),
            new PrivateChannel("customer.{$this->booking->customer_id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'ride.assigned';
    }

    public function broadcastWith(): array
    {
        return [
            'ride_id' => $this->booking->id,
            'booking_number' => $this->booking->booking_number,
            'pickup_location' => $this->booking->pickup_location,
            'dropoff_location' => $this->booking->dropoff_location,
            'total_fare' => $this->booking->total_fare,
            'customer_id' => $this->booking->customer_id,
            'driver_id' => $this->driverId,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}

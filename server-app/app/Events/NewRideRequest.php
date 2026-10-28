<?php

namespace App\Events;

use App\Models\RideBooking;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewRideRequest implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public RideBooking $booking,
        public array $candidateDriverIds = [],
    ) {}

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('drivers.available'),
        ];

        foreach ($this->candidateDriverIds as $driverId) {
            $channels[] = new PrivateChannel("driver.{$driverId}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'ride.new_request';
    }

    public function broadcastWith(): array
    {
        return [
            'ride_id' => $this->booking->id,
            'id' => $this->booking->id,
            'booking_number' => $this->booking->booking_number,
            'pickup_location' => $this->booking->pickup_location,
            'dropoff_location' => $this->booking->dropoff_location,
            'pickup_lat' => $this->booking->pickup_lat,
            'pickup_lng' => $this->booking->pickup_lng,
            'total_fare' => $this->booking->total_fare,
            'full_car_fare' => $this->booking->full_car_fare,
            'service_type' => $this->booking->service_type,
            'ride_mode' => $this->booking->ride_mode,
            'sharing_requested' => (bool) $this->booking->sharing_requested,
            'sharing_enabled_by' => $this->booking->sharing_enabled_by,
            'reserved_seats' => (int) $this->booking->reserved_seats,
            'sharing_savings' => $this->booking->sharing_savings,
            'distance_km' => $this->booking->estimated_distance_km,
            'estimated_distance_km' => $this->booking->estimated_distance_km,
            'estimated_duration' => $this->booking->estimated_duration,
            'payment_method' => $this->booking->payment_method,
            'candidate_driver_ids' => $this->candidateDriverIds,
            'targeted' => $this->candidateDriverIds !== [],
            'timestamp' => now()->toIso8601String(),
        ];
    }
}

<?php

namespace App\Services\BookingState;

class RideStateEngine implements BookingStateEngine
{
    public function serviceType(): string
    {
        return 'ride';
    }

    public function normalize(string $status): ?string
    {
        return match ($status) {
            'pending' => 'pending',
            'confirmed' => 'confirmed',
            'driver_assigned' => 'driver_assigned',
            'driver_arriving', 'on_the_way' => 'driver_arriving',
            'pickup', 'arrived' => 'pickup',
            'in_transit', 'started' => 'in_transit',
            'completed' => 'completed',
            'cancelled', 'canceled' => 'cancelled',
            default => null,
        };
    }

    public function states(): array
    {
        return ['pending', 'confirmed', 'driver_assigned', 'driver_arriving', 'pickup', 'in_transit', 'completed', 'cancelled'];
    }

    public function allowedTransitions(string $currentStatus, string $actor): array
    {
        $currentStatus = $this->normalize($currentStatus) ?? $currentStatus;

        if ($actor === 'customer') {
            return in_array($currentStatus, ['pending', 'confirmed', 'driver_assigned', 'driver_arriving', 'pickup', 'in_transit'], true)
                ? ['cancelled']
                : [];
        }

        if ($actor === 'driver') {
            return match ($currentStatus) {
                'driver_assigned' => ['driver_arriving', 'cancelled'],
                'driver_arriving' => ['pickup', 'cancelled'],
                'pickup' => ['in_transit', 'cancelled'],
                'in_transit' => ['completed'],
                default => [],
            };
        }

        return match ($currentStatus) {
            'pending' => ['confirmed', 'cancelled'],
            'confirmed' => ['driver_assigned', 'cancelled'],
            'driver_assigned' => ['driver_arriving', 'cancelled'],
            'driver_arriving' => ['pickup', 'cancelled'],
            'pickup' => ['in_transit', 'cancelled'],
            'in_transit' => ['completed', 'cancelled'],
            default => [],
        };
    }
}

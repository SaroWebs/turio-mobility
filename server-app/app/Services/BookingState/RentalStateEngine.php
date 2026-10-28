<?php

namespace App\Services\BookingState;

class RentalStateEngine implements BookingStateEngine
{
    public function serviceType(): string
    {
        return 'rental';
    }

    public function normalize(string $status): ?string
    {
        return match ($status) {
            'pending' => 'pending',
            'confirmed' => 'confirmed',
            'driver_assigned' => 'driver_assigned',
            'in_progress', 'started' => 'in_progress',
            'completed' => 'completed',
            'cancelled', 'canceled' => 'cancelled',
            default => null,
        };
    }

    public function states(): array
    {
        return ['pending', 'confirmed', 'driver_assigned', 'in_progress', 'completed', 'cancelled'];
    }

    public function allowedTransitions(string $currentStatus, string $actor): array
    {
        $currentStatus = $this->normalize($currentStatus) ?? $currentStatus;

        if ($actor === 'customer') {
            return in_array($currentStatus, ['pending', 'confirmed', 'driver_assigned', 'in_progress'], true) ? ['cancelled'] : [];
        }

        if ($actor === 'driver') {
            return match ($currentStatus) {
                'driver_assigned' => ['in_progress'],
                'in_progress' => ['completed'],
                default => [],
            };
        }

        return match ($currentStatus) {
            'pending' => ['confirmed', 'cancelled'],
            'confirmed' => ['driver_assigned', 'cancelled'],
            'driver_assigned' => ['in_progress', 'completed', 'cancelled'],
            'in_progress' => ['completed', 'cancelled'],
            default => [],
        };
    }
}

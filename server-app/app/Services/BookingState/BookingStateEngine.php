<?php

namespace App\Services\BookingState;

interface BookingStateEngine
{
    public function serviceType(): string;

    public function normalize(string $status): ?string;

    public function allowedTransitions(string $currentStatus, string $actor): array;

    public function states(): array;
}

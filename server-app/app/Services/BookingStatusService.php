<?php

namespace App\Services;

use App\Services\BookingState\BookingStateEngine;
use App\Services\BookingState\RentalStateEngine;
use App\Services\BookingState\RideStateEngine;
use App\Services\BookingState\TourStateEngine;

class BookingStatusService
{
    public const RIDE = 'ride';

    public const TOUR = 'tour';

    public const RENTAL = 'rental';

    /** @var array<string, BookingStateEngine> */
    private array $engines;

    public function __construct()
    {
        $engines = [new RideStateEngine, new TourStateEngine, new RentalStateEngine];
        $this->engines = [];

        foreach ($engines as $engine) {
            $this->engines[$engine->serviceType()] = $engine;
        }
    }

    public function normalize(string $serviceType, string $status): ?string
    {
        return $this->engine($serviceType)?->normalize($status);
    }

    public function allowedTransitions(string $serviceType, string $currentStatus, string $actor = 'admin'): array
    {
        return $this->engine($serviceType)?->allowedTransitions($currentStatus, $actor) ?? [];
    }

    public function canTransition(
        string $serviceType,
        string $currentStatus,
        string $requestedStatus,
        string $actor = 'admin'
    ): bool {
        $requestedStatus = $this->normalize($serviceType, $requestedStatus);

        return $requestedStatus !== null
            && in_array($requestedStatus, $this->allowedTransitions($serviceType, $currentStatus, $actor), true);
    }

    public function definition(string $serviceType, string $actor = 'admin'): array
    {
        $engine = $this->engine($serviceType);
        if (! $engine) {
            return [];
        }

        return [
            'service_type' => $serviceType,
            'actor' => $actor,
            'states' => $engine->states(),
            'transitions' => collect($engine->states())
                ->mapWithKeys(fn (string $state) => [$state => $engine->allowedTransitions($state, $actor)])
                ->all(),
        ];
    }

    private function engine(string $serviceType): ?BookingStateEngine
    {
        return $this->engines[$serviceType] ?? null;
    }
}

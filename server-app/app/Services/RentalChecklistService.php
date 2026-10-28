<?php

namespace App\Services;

use App\Models\CarRental;
use App\Models\RentalChecklist;

class RentalChecklistService
{
    /**
     * Submit a checklist (handover or return) for a rental.
     */
    public function submitChecklist(CarRental $rental, string $type, array $data, string $actorType, int $actorId): RentalChecklist
    {
        $checklist = RentalChecklist::updateOrCreate(
            ['car_rental_id' => $rental->id, 'type' => $type],
            array_merge($data, [
                'completed_by_type' => $actorType,
                'completed_by_id' => $actorId,
            ])
        );

        return $checklist;
    }

    /**
     * Compare handover and return checklists to flag differences.
     */
    public function compareChecklists(CarRental $rental): array
    {
        $handover = $rental->checklists()->where('type', 'handover')->first();
        $return = $rental->checklists()->where('type', 'return')->first();

        if (!$handover || !$return) {
            return [];
        }

        $odometerDelta = ($return->odometer_reading ?? 0) - ($handover->odometer_reading ?? 0);
        $fuelDelta = ($return->fuel_level_percent ?? 0) - ($handover->fuel_level_percent ?? 0);
        
        $newDamage = $return->damage_detected && !$handover->damage_detected;

        return [
            'odometer_delta' => $odometerDelta,
            'fuel_delta' => $fuelDelta,
            'new_damage_detected' => $newDamage,
        ];
    }

    /**
     * Validate if the rental is ready for return completion.
     */
    public function validateReturnReadiness(CarRental $rental): array
    {
        $missing = [];
        $returnChecklist = $rental->checklists()->where('type', 'return')->first();

        if (!$returnChecklist) {
            $missing[] = 'Return checklist is missing.';
        }

        return $missing;
    }
}

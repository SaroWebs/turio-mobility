<?php

namespace App\Services;

use App\Models\CarpoolPolicy;
use App\Models\Vehicle;

class CarpoolPricing
{
    public function quote(CarpoolPolicy $policy, Vehicle $vehicle, int $distance, int $tolls, int $seats): array
    {
        $rules = $policy->rules;
        abort_unless(in_array($vehicle->fuel_type, ['petrol', 'diesel', 'hybrid']), 422, 'This cost estimator supports reviewed liquid-fuel vehicles only.');
        $consumption = $rules['vehicle_consumption_ml_per_km'][(string) $vehicle->id] ?? $rules['consumption_ml_per_km'][$vehicle->fuel_type] ?? null;
        abort_unless($consumption && isset($rules['fuel_price_minor_per_litre']), 422, 'Configure fuel and vehicle consumption estimates for this market.');
        abort_if($tolls > $rules['max_toll_minor'], 422, 'Toll estimate exceeds the reviewed regional limit.');
        // Integer arithmetic, rounded up once. Distance is metres; consumption ml/km.
        $fuel = intdiv($distance * $consumption * $rules['fuel_price_minor_per_litre'] + 999999, 1000000);
        $eligible = $fuel + $tolls;
        $driver = intdiv($eligible * $rules['driver_min_bps'] + 9999, 10000);
        $total = $eligible - $driver;
        $maximum = $rules['allocation'] === 'equal_occupants' ? min(intdiv($eligible, $seats + 1), intdiv($total, $seats)) : intdiv($total, $seats);

        return ['policy_id' => $policy->id, 'version' => $policy->version, 'region' => $policy->region,
            'currency' => $policy->currency, 'source' => 'Admin-configured fuel/consumption estimates; driver-declared distance and toll estimate',
            'fuel_minor' => $fuel, 'toll_minor' => $tolls, 'eligible_cost_minor' => $eligible,
            'driver_min_minor' => $driver, 'suggested_minor' => min($maximum, intdiv($eligible, $seats + 1)),
            'max_seat_minor' => $maximum, 'max_total_minor' => $total, 'rules' => $rules];
    }
}

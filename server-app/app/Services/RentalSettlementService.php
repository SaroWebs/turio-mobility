<?php

namespace App\Services;

use App\Models\CarCategory;
use App\Models\CarRental;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Calculates and records extra charges at end-of-rental settlement (G-43).
 *
 * Charges computed:
 *  - km overage:   max(0, actual_km - included_km) × extra_km_charge
 *  - extra hours:  max(0, overtime_hours) × extra_hour_charge
 *  - surcharges:   tolls, parking, fuel, or other line items passed at completion
 */
class RentalSettlementService
{
    /**
     * Preview extra charges without persisting.
     *
     * @param  array<string, mixed>  $usage  Keys: actual_km, actual_return_at, surcharge_items [{name, amount}]
     * @return array{km_overage_charge: float, extra_hours_charge: float, surcharges: float, settlement_total: float, breakdown: array}
     */
    public function preview(CarRental $rental, array $usage): array
    {
        $category = $rental->carCategory ?? CarCategory::find($rental->car_category_id);

        $days = max(1, (int) $rental->number_of_days);
        $actualKm = isset($usage['actual_km']) ? (float) $usage['actual_km'] : null;
        $actualReturnAt = isset($usage['actual_return_at']) ? Carbon::parse($usage['actual_return_at']) : null;

        // ── Km overage ─────────────────────────────────────────────
        $includedKm = $category?->included_km_per_day !== null
            ? $category->included_km_per_day * $days
            : null;
        $extraKm = ($includedKm !== null && $actualKm !== null)
            ? max(0, $actualKm - $includedKm)
            : 0.0;
        $extraKmRate = (float) ($category?->extra_km_charge ?? 0);
        $kmOverageCharge = round($extraKm * $extraKmRate, 2);

        // ── Extra hours / overtime ──────────────────────────────────
        $includedHoursPerDay = $category?->included_hours_per_day;
        $extraHourRate = (float) ($category?->extra_hour_charge ?? 0);
        $overtimeHours = 0.0;

        if ($includedHoursPerDay !== null && $actualReturnAt !== null) {
            $scheduledReturn = Carbon::parse($rental->end_date->toDateString().' '.$rental->end_time);
            $lateHours = max(0, $actualReturnAt->floatDiffInHours($scheduledReturn, false));
            // Grace period: first 30 min is free
            $gracePeriodHours = (float) setting('rental.overtime_grace_minutes', 30) / 60;
            $overtimeHours = max(0, $lateHours - $gracePeriodHours);
        }
        $extraHoursCharge = round($overtimeHours * $extraHourRate, 2);

        // ── Surcharges (tolls, parking, fuel) ───────────────────────
        $surchargeItems = $usage['surcharge_items'] ?? [];
        $surcharges = round(collect($surchargeItems)->sum('amount'), 2);

        $settlementTotal = round($kmOverageCharge + $extraHoursCharge + $surcharges, 2);

        return [
            'km_overage_charge' => $kmOverageCharge,
            'extra_hours_charge' => $extraHoursCharge,
            'surcharges' => $surcharges,
            'settlement_total' => $settlementTotal,
            'breakdown' => [
                'actual_km' => $actualKm,
                'included_km' => $includedKm,
                'extra_km' => $extraKm,
                'extra_km_rate' => $extraKmRate,
                'overtime_hours' => round($overtimeHours, 2),
                'extra_hour_rate' => $extraHourRate,
                'surcharge_items' => $surchargeItems,
            ],
        ];
    }

    /**
     * Calculate and persist settlement charges on a completed rental.
     */
    public function settle(CarRental $rental, array $usage, ?int $adminId = null): CarRental
    {
        return DB::transaction(function () use ($rental, $usage, $adminId) {
            $locked = CarRental::lockForUpdate()->findOrFail($rental->id);

            abort_if($locked->status !== 'completed', 422, 'Settlement can only be applied to completed rentals.');
            abort_if($locked->settled_at !== null, 422, 'This rental has already been settled.');

            $result = $this->preview($locked, $usage);

            $locked->forceFill([
                'actual_km' => $usage['actual_km'] ?? null,
                'actual_return_at' => isset($usage['actual_return_at']) ? Carbon::parse($usage['actual_return_at']) : null,
                'km_overage_charge' => $result['km_overage_charge'],
                'extra_hours_charge' => $result['extra_hours_charge'],
                'surcharges' => $result['surcharges'],
                'surcharge_items' => $result['breakdown']['surcharge_items'],
                'settlement_total' => $result['settlement_total'],
                'settlement_notes' => $usage['notes'] ?? null,
                'settled_at' => now(),
            ])->save();

            $locked->auditLogs()->create([
                'action' => 'rental.settled',
                'note' => 'Extra charges settled: ₹'.number_format($result['settlement_total'], 2),
                'after' => [
                    'settlement_total' => $result['settlement_total'],
                    'breakdown' => $result['breakdown'],
                    'admin_id' => $adminId,
                ],
            ]);

            app(BookingLifecycleNotifier::class)->emit(
                $locked->fresh('customer'),
                'rental.settled',
                ['settlement_total' => $result['settlement_total']]
            );

            return $locked->fresh();
        });
    }
}

<?php

namespace App\Services;

use App\Models\TourSchedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TourInventoryReconciliation
{
    public function run(bool $repair = false): array
    {
        $result = ['checked' => 0, 'mismatched' => 0, 'repaired' => 0, 'over_capacity' => 0, 'protected_pending' => 0, 'missing_deadline' => 0];
        TourSchedule::orderBy('id')->chunkById(100, function ($schedules) use ($repair, &$result) {
            foreach ($schedules as $schedule) {
                DB::transaction(function () use ($schedule, $repair, &$result) {
                    $schedule = TourSchedule::lockForUpdate()->findOrFail($schedule->id);
                    // Counter repair must never guess how to settle or cancel funded holds.
                    $protected = $schedule->bookings()->where('status', 'pending')
                        ->where('payment_status', '!=', 'pending')->count();
                    $missingDeadline = $schedule->bookings()->where('status', 'pending')
                        ->where('payment_status', 'pending')->whereNull('hold_expires_at')->count();
                    $result['protected_pending'] += $protected;
                    $result['missing_deadline'] += $missingDeadline;
                    if ($protected || $missingDeadline) {
                        Log::warning('Tour holds require lifecycle review', ['schedule_id' => $schedule->id,
                            'protected_pending' => $protected, 'missing_deadline' => $missingDeadline]);
                    }
                    $counts = $schedule->bookings()->where('status', '!=', 'cancelled')
                        ->selectRaw("COALESCE(SUM(CASE WHEN status = 'pending' THEN number_of_adults + COALESCE(number_of_children, 0) ELSE 0 END), 0) AS held")
                        ->selectRaw("COALESCE(SUM(CASE WHEN status != 'pending' THEN number_of_adults + COALESCE(number_of_children, 0) ELSE 0 END), 0) AS booked")
                        ->first();
                    $held = (int) $counts->held;
                    $booked = (int) $counts->booked;
                    $result['checked']++;
                    if ($held + $booked > $schedule->total_seats) {
                        $result['over_capacity']++;
                        Log::warning('Tour bookings exceed departure capacity', ['schedule_id' => $schedule->id, 'held' => $held, 'booked' => $booked]);
                    }
                    if ($held === (int) $schedule->reserved_seats && $booked === (int) $schedule->booked_seats) {
                        return;
                    }
                    $result['mismatched']++;
                    Log::warning('Tour inventory counter mismatch', ['schedule_id' => $schedule->id, 'reserved_before' => $schedule->reserved_seats, 'booked_before' => $schedule->booked_seats, 'held' => $held, 'booked' => $booked, 'repair' => $repair]);
                    if ($repair) {
                        $schedule->update(['reserved_seats' => $held, 'booked_seats' => $booked]);
                        $result['repaired']++;
                    }
                });
            }
        });

        return $result;
    }
}

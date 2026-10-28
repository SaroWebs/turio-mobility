<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\RideDispatchAttempt;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DispatchMetricsService
{
    /**
     * Calculate dispatch metrics for a time window.
     */
    public function metrics(?Carbon $since = null, ?Carbon $until = null): array
    {
        $query = RideBooking::query();
        if ($since) {
            $query->where('created_at', '>=', $since);
        }
        if ($until) {
            $query->where('created_at', '<=', $until);
        }

        $totalRides = (clone $query)->count();

        $assignedRides = (clone $query)->whereNotNull('driver_assigned_at')->get();
        $totalAssigned = $assignedRides->count();

        $timeToAssign = $totalAssigned > 0
            ? $assignedRides->sum(function ($r) {
                return max(0, $r->created_at->diffInSeconds($r->driver_assigned_at));
            }) / $totalAssigned
            : 0;

        $expiredRides = (clone $query)->whereNull('driver_id')
            ->where('status', 'cancelled')->where('request_outcome', 'expired')
            ->count();

        $noDriverRate = $totalRides > 0 ? ($expiredRides / $totalRides) * 100 : 0;

        $attemptsQuery = RideDispatchAttempt::query();
        if ($since) {
            $attemptsQuery->where('created_at', '>=', $since);
        }
        if ($until) {
            $attemptsQuery->where('created_at', '<=', $until);
        }

        $resolvedAttempts = (clone $attemptsQuery)->whereIn('status', ['accepted', 'declined', 'expired'])->count();
        $acceptedAttempts = (clone $attemptsQuery)->where('status', 'accepted')->count();

        $acceptanceRate = $resolvedAttempts > 0 ? ($acceptedAttempts / $resolvedAttempts) * 100 : 0;

        $driverOffers = (clone $attemptsQuery)->select('driver_id', DB::raw('count(*) as count'))
            ->groupBy('driver_id')
            ->pluck('count')
            ->toArray();

        $gini = $this->calculateGini($driverOffers);

        return [
            'time_to_assign' => $timeToAssign,
            'acceptance_rate' => $acceptanceRate,
            'no_driver_rate' => $noDriverRate,
            'offer_distribution' => $gini,
        ];
    }

    /**
     * Per-driver dispatch statistics.
     */
    public function driverStats(Driver $driver, ?Carbon $since = null): array
    {
        $attemptsQuery = $driver->rideDispatchAttempts();
        if ($since) {
            $attemptsQuery->where('created_at', '>=', $since);
        }

        $totalOffers = (clone $attemptsQuery)->count();
        $accepted = (clone $attemptsQuery)->where('status', 'accepted')->count();
        $declined = (clone $attemptsQuery)->where('status', 'declined')->count();
        $expired = (clone $attemptsQuery)->where('status', 'expired')->count();

        $avgResponse = (clone $attemptsQuery)->whereNotNull('responded_at')->whereNotNull('offered_at')->get()
            ->avg(fn ($attempt) => max(0, $attempt->offered_at->diffInSeconds($attempt->responded_at))) ?? 0;

        $lastOffered = (clone $attemptsQuery)->max('offered_at');
        $lastAccepted = (clone $attemptsQuery)->where('status', 'accepted')->max('responded_at');

        $lastRide = $driver->rideBookings()
            ->where('status', 'completed')
            ->orderBy('id', 'desc')
            ->first();

        $idleSeconds = $lastRide ? $lastRide->updated_at->diffInSeconds(now()) : null;

        return [
            'total_offers' => $totalOffers,
            'accepted' => $accepted,
            'declined' => $declined,
            'expired' => $expired,
            'avg_response_time_seconds' => $avgResponse,
            'last_offered_at' => $lastOffered,
            'last_accepted_at' => $lastAccepted,
            'idle_seconds' => $idleSeconds,
        ];
    }

    private function calculateGini(array $values): float
    {
        if (empty($values)) {
            return 0.0;
        }
        $n = count($values);
        sort($values);
        $sum = array_sum($values);
        if ($sum == 0) {
            return 0.0;
        }

        $giniNumerator = 0;
        for ($i = 0; $i < $n; $i++) {
            $giniNumerator += ($i + 1) * $values[$i];
        }

        return (2 * $giniNumerator) / ($n * $sum) - ($n + 1) / $n;
    }
}

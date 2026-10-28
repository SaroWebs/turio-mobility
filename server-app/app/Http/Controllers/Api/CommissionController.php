<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\RideBooking;
use App\Services\CommissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommissionController extends Controller
{
    protected CommissionService $commissionService;

    public function __construct(CommissionService $commissionService)
    {
        $this->commissionService = $commissionService;
    }

    /**
     * Get commission statistics
     */
    public function getStats(Request $request)
    {
        $startDate = $request->input('start_date', now()->subDays(30)->toDateString());
        $endDate = $request->input('end_date', now()->toDateString());
        $serviceType = $request->input('service_type', 'all');

        // Base query
        $query = RideBooking::where('status', 'completed')
            ->whereNotNull('commission_amount')
            ->whereBetween('created_at', [$startDate.' 00:00:00', $endDate.' 23:59:59']);

        if ($serviceType !== 'all') {
            $query->where('service_type', $serviceType);
        }

        // Total commission
        $totalCommission = (clone $query)->sum('commission_amount');
        $commissionCount = (clone $query)->count();

        // Today's commission
        $todayCommission = RideBooking::where('status', 'completed')
            ->whereNotNull('commission_amount')
            ->whereDate('created_at', today())
            ->sum('commission_amount');

        // This month's commission
        $monthCommission = RideBooking::where('status', 'completed')
            ->whereNotNull('commission_amount')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum('commission_amount');

        // Average commission
        $averageCommission = $commissionCount > 0 ? $totalCommission / $commissionCount : 0;

        // Commission by service type
        $byServiceType = (clone $query)
            ->select('service_type', DB::raw('COUNT(*) as count'), DB::raw('SUM(commission_amount) as total'))
            ->groupBy('service_type')
            ->get()
            ->map(function ($item) use ($totalCommission) {
                return [
                    'type' => $item->service_type,
                    'count' => $item->count,
                    'total' => (float) $item->total,
                    'percentage' => $totalCommission > 0 ? round(($item->total / $totalCommission) * 100, 1) : 0,
                ];
            });

        // Top drivers by commission
        $topDrivers = (clone $query)
            ->select('driver_id', DB::raw('COUNT(*) as total_rides'), DB::raw('SUM(commission_amount) as total_commission'), DB::raw('SUM(driver_share) as total_earnings'))
            ->with('driver:id,name')
            ->groupBy('driver_id')
            ->orderByDesc('total_commission')
            ->limit(10)
            ->get()
            ->map(function ($item) {
                return [
                    'driver_id' => $item->driver_id,
                    'driver_name' => $item->driver?->name ?? 'Unknown',
                    'total_rides' => $item->total_rides,
                    'total_commission' => (float) $item->total_commission,
                    'total_earnings' => (float) $item->total_earnings,
                ];
            });

        // Daily trend (last 7 days)
        $dailyTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $dayStats = RideBooking::where('status', 'completed')
                ->whereNotNull('commission_amount')
                ->whereDate('created_at', $date)
                ->select(DB::raw('SUM(commission_amount) as commission'), DB::raw('COUNT(*) as rides'))
                ->first();

            $dailyTrend[] = [
                'date' => $date,
                'commission' => (float) ($dayStats->commission ?? 0),
                'rides' => $dayStats->rides ?? 0,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'total_commission' => (float) $totalCommission,
                'today_commission' => (float) $todayCommission,
                'month_commission' => (float) $monthCommission,
                'pending_commission' => 0, // Calculate if needed
                'commission_count' => $commissionCount,
                'average_commission' => round($averageCommission, 2),
                'by_service_type' => $byServiceType,
                'by_driver' => $topDrivers,
                'daily_trend' => $dailyTrend,
            ],
        ]);
    }

    /**
     * Get commission transactions
     */
    public function getTransactions(Request $request)
    {
        $startDate = $request->input('start_date', now()->subDays(30)->toDateString());
        $endDate = $request->input('end_date', now()->toDateString());
        $serviceType = $request->input('service_type', 'all');

        $query = RideBooking::with('driver:id,name')
            ->where('status', 'completed')
            ->whereNotNull('commission_amount')
            ->whereBetween('created_at', [$startDate.' 00:00:00', $endDate.' 23:59:59']);

        if ($serviceType !== 'all') {
            $query->where('service_type', $serviceType);
        }

        $transactions = $query->orderByDesc('created_at')
            ->paginate(50)
            ->through(function ($booking) {
                return [
                    'id' => $booking->id,
                    'booking_number' => $booking->booking_number,
                    'driver_name' => $booking->driver?->name ?? 'Unknown',
                    'service_type' => $booking->service_type,
                    'total_fare' => (float) $booking->total_fare,
                    'commission_amount' => (float) $booking->commission_amount,
                    'driver_share' => (float) $booking->driver_share,
                    'status' => $booking->payment_status ?? 'completed',
                    'created_at' => $booking->created_at->toIso8601String(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $transactions->items(),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ],
        ]);
    }

    /**
     * Get driver-specific commission stats
     */
    public function getDriverStats(Request $request, $driverId)
    {
        $driver = Driver::findOrFail($driverId);

        // Total commission from this driver
        $totalCommission = RideBooking::where('driver_id', $driverId)
            ->where('status', 'completed')
            ->sum('commission_amount');

        // Total rides
        $totalRides = RideBooking::where('driver_id', $driverId)
            ->where('status', 'completed')
            ->count();

        // Total earnings (driver share)
        $totalEarnings = RideBooking::where('driver_id', $driverId)
            ->where('status', 'completed')
            ->sum('driver_share');

        // This month's stats
        $monthStats = RideBooking::where('driver_id', $driverId)
            ->where('status', 'completed')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->select(DB::raw('COUNT(*) as rides'), DB::raw('SUM(commission_amount) as commission'), DB::raw('SUM(driver_share) as earnings'))
            ->first();

        // Today's stats
        $todayStats = RideBooking::where('driver_id', $driverId)
            ->where('status', 'completed')
            ->whereDate('created_at', today())
            ->select(DB::raw('COUNT(*) as rides'), DB::raw('SUM(commission_amount) as commission'), DB::raw('SUM(driver_share) as earnings'))
            ->first();

        return response()->json([
            'success' => true,
            'data' => [
                'driver' => [
                    'id' => $driver->id,
                    'name' => $driver->name,
                ],
                'total_commission' => (float) $totalCommission,
                'total_rides' => $totalRides,
                'total_earnings' => (float) $totalEarnings,
                'month' => [
                    'rides' => $monthStats->rides ?? 0,
                    'commission' => (float) ($monthStats->commission ?? 0),
                    'earnings' => (float) ($monthStats->earnings ?? 0),
                ],
                'today' => [
                    'rides' => $todayStats->rides ?? 0,
                    'commission' => (float) ($todayStats->commission ?? 0),
                    'earnings' => (float) ($todayStats->earnings ?? 0),
                ],
            ],
        ]);
    }
}

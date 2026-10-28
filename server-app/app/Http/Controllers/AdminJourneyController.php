<?php

namespace App\Http\Controllers;

use App\Models\RideBooking;
use App\Models\TourDriverAssignment;
use App\Services\RideRequestLifecycle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AdminJourneyController extends Controller
{
    public function index(Request $request)
    {
        $archived = $request->boolean('archive');

        return inertia('admin/JourneyOperations', [
            'title' => 'Journey operations', 'archive' => $archived,
            'rides' => RideBooking::with('driver:id,name')->when($archived,
                fn ($q) => $q->whereNotNull('request_outcome'),
                fn ($q) => $q->whereIn('status', ['pending', 'confirmed', 'driver_assigned', 'driver_arriving', 'pickup', 'in_transit']))
                ->latest()->paginate(20)->withQueryString(),
            'departures' => TourDriverAssignment::with(['schedule.tour:id,title', 'driver:id,name', 'vehicle:id,registration_number'])
                ->whereHas('schedule', fn ($q) => $q->whereDate('departure_date', '<=', today())->whereDate('return_date', '>=', today()))->get(),
            'demand' => DB::table('ride_demand_daily')->orderByDesc('day')->limit(30)->get(),
            'purge' => Cache::get('ride-request-purge-last'),
            'retention_days' => setting('ride.retention.days', 30),
        ]);
    }

    public function previewPurge(RideRequestLifecycle $service)
    {
        $result = $service->purge(true);
        Cache::forever('ride-request-purge-last', ['at' => now()->toIso8601String(), 'dry_run' => true, ...$result]);

        return back()->with('success', 'Retention preview completed. No records were deleted.');
    }
}

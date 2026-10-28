<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\SharedTrip;
use App\Services\SharedTripService;
use Illuminate\Http\Request;

class SharedTripController extends Controller
{
    public function preference(Request $r, RideBooking $booking, \App\Services\RideSharingPreference $preferences)
    {
        abort_unless($r->user() instanceof Customer && $booking->customer_id == $r->user()->id, 403);
        $data = $r->validate(['sharing_requested' => 'required|boolean']);
        $ride = $preferences->update($r->user(), $booking, $data['sharing_requested']);
        $ride->setAttribute('sharing_control', $preferences->control($ride));

        return response()->json(['data' => $ride]);
    }

    public function search(Request $r, SharedTripService $service)
    {
        abort_unless($r->user() instanceof Customer, 403);
        $data = $r->validate([
            'pickup_lat' => 'required|numeric|between:-90,90', 'pickup_lng' => 'required|numeric|between:-180,180',
            'dropoff_lat' => 'required|numeric|between:-90,90', 'dropoff_lng' => 'required|numeric|between:-180,180',
            'pickup_location' => 'required|string|max:255', 'dropoff_location' => 'required|string|max:255',
            'seats' => 'required|integer|min:1|max:3', 'ready_in_seconds' => 'sometimes|integer|min:0|max:600',
        ]);

        return response()->json(['data' => $service->search($r->user(), [
            'pickup' => ['lat' => (float) $data['pickup_lat'], 'lng' => (float) $data['pickup_lng'], 'label' => $data['pickup_location']],
            'dropoff' => ['lat' => (float) $data['dropoff_lat'], 'lng' => (float) $data['dropoff_lng'], 'label' => $data['dropoff_location']],
            'seats' => $data['seats'], 'ready_at' => now()->timestamp + ($data['ready_in_seconds'] ?? 30),
        ])]);
    }

    public function join(Request $r, SharedTripService $service)
    {
        abort_unless($r->user() instanceof Customer, 403);
        $data = $r->validate(['offer_id' => 'required|uuid', 'payment_method' => 'required|in:cash,wallet']);

        return response()->json(['data' => $service->join($r->user(), $data['offer_id'], $data['payment_method'])], 201);
    }

    public function open(Request $r, RideBooking $booking, SharedTripService $service)
    {
        abort_unless($r->user() instanceof Driver && $booking->driver_id == $r->user()->id, 403);
        $data = $r->validate(['accepting' => 'required|boolean', 'allow_extension' => 'required|boolean']);
        if (! $data['accepting']) {
            \Illuminate\Support\Facades\DB::transaction(function () use ($booking) {
                Driver::whereKey($booking->driver_id)->lockForUpdate()->firstOrFail();
                $trip = SharedTrip::whereKey($booking->shared_trip_id)->lockForUpdate()->first();
                if ($trip) {
                    $trip->update(['accepting' => false, 'version' => $trip->version + 1]);
                }
            });
        } else {
            $service->open($booking, $r->user(), $data['allow_extension']);
        }

        return response()->json(['success' => true]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DriverAvailability;
use App\Models\VehicleLocation;
use App\Models\VehicleTracker;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class VehicleTrackerController extends Controller
{
    public function location(Request $request)
    {
        $plainToken = $request->bearerToken();
        if (! $plainToken) {
            if ($tracker->vehicle?->driver) {
                app(\App\Services\JourneyTrackingService::class)->publishForDriver($tracker->vehicle->driver);
            }

            return response()->json(['success' => false, 'message' => 'Tracker token is required.'], 401);
        }

        $tracker = VehicleTracker::query()
            ->with('vehicle:id,driver_id')
            ->where('token_hash', hash('sha256', $plainToken))
            ->first();

        if (! $tracker || $tracker->status !== 'active') {
            return response()->json(['success' => false, 'message' => 'Tracker is not authorized.'], 401);
        }

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'recorded_at' => ['nullable', 'date', 'before_or_equal:tomorrow'],
            'sequence_number' => ['nullable', 'integer', 'min:0'],
            'heading' => ['nullable', 'numeric', 'between:0,360'],
            'speed_kmh' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'accuracy_m' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'battery_percent' => ['nullable', 'integer', 'between:0,100'],
            'ignition_on' => ['nullable', 'boolean'],
            'metadata' => ['nullable', 'array', 'max:50'],
        ]);

        $recordedAt = isset($validated['recorded_at']) ? Carbon::parse($validated['recorded_at']) : now();

        $location = DB::transaction(function () use ($tracker, $validated, $recordedAt) {
            $attributes = [
                'vehicle_id' => $tracker->vehicle_id,
                'vehicle_tracker_id' => $tracker->id,
                'sequence_number' => $validated['sequence_number'] ?? null,
                'latitude' => $validated['latitude'],
                'longitude' => $validated['longitude'],
                'heading' => $validated['heading'] ?? null,
                'speed_kmh' => $validated['speed_kmh'] ?? null,
                'accuracy_m' => $validated['accuracy_m'] ?? null,
                'battery_percent' => $validated['battery_percent'] ?? null,
                'ignition_on' => $validated['ignition_on'] ?? null,
                'recorded_at' => $recordedAt,
                'received_at' => now(),
                'metadata' => $validated['metadata'] ?? null,
            ];

            $location = isset($validated['sequence_number'])
                ? VehicleLocation::updateOrCreate([
                    'vehicle_tracker_id' => $tracker->id,
                    'sequence_number' => $validated['sequence_number'],
                ], $attributes)
                : VehicleLocation::create($attributes);

            $isLatestPosition = ! $tracker->last_recorded_at || $recordedAt->greaterThanOrEqualTo($tracker->last_recorded_at);
            if ($isLatestPosition) {
                $tracker->update([
                    'latitude' => $validated['latitude'],
                    'longitude' => $validated['longitude'],
                    'heading' => $validated['heading'] ?? null,
                    'speed_kmh' => $validated['speed_kmh'] ?? null,
                    'accuracy_m' => $validated['accuracy_m'] ?? null,
                    'battery_percent' => $validated['battery_percent'] ?? null,
                    'ignition_on' => $validated['ignition_on'] ?? null,
                    'last_ping_at' => now(),
                    'last_recorded_at' => $recordedAt,
                ]);
            } else {
                $tracker->update(['last_ping_at' => now()]);
            }

            if ($isLatestPosition && $tracker->vehicle?->driver_id) {
                $availability = DriverAvailability::firstOrNew(['driver_id' => $tracker->vehicle->driver_id]);
                if (! $availability->exists) {
                    $availability->status = 'offline';
                    $availability->is_available = false;
                }
                $availability->fill([
                    'current_lat' => $validated['latitude'],
                    'current_lng' => $validated['longitude'],
                    'last_updated' => now(),
                ])->save();
            }

            return $location;
        });

        return response()->json([
            'success' => true,
            'data' => [
                'location_id' => $location->id,
                'device_uid' => $tracker->device_uid,
                'received_at' => $location->received_at,
            ],
        ], 202);
    }
}

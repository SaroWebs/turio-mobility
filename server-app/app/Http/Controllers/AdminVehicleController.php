<?php

namespace App\Http\Controllers;

use App\Models\CarCategory;
use App\Models\Driver;
use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminVehicleController extends Controller
{
    public function index(Request $request)
    {
        $query = Vehicle::with(['category', 'driver', 'tracker']);

        if ($search = $request->input('search')) {
            $query->where('registration_number', 'like', "%{$search}%")
                ->orWhere('make', 'like', "%{$search}%")
                ->orWhere('model', 'like', "%{$search}%");
        }

        $vehicles = $query->latest()->paginate(15);
        $categories = CarCategory::all();
        $drivers = Driver::where('status', 'active')
            ->with('vehicle:id,driver_id,registration_number')
            ->get();

        return inertia('admin/Vehicles/Index', [
            'title' => 'Vehicle Management',
            'user' => Auth::user(),
            'vehicles' => $vehicles,
            'categories' => $categories,
            'drivers' => $drivers,
            'filters' => $request->only('search'),
            'tracker_credentials' => session('tracker_credentials'),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'car_category_id' => 'required|exists:car_categories,id',
            'driver_id' => ['nullable', 'exists:drivers,id', Rule::unique('vehicles', 'driver_id')],
            'registration_number' => 'required|string|unique:vehicles',
            'make' => 'required|string',
            'model' => 'required|string',
            'year' => 'required|integer',
            'color' => 'required|string',
            'fuel_type' => 'required|string',
            'seats' => 'required|integer',
            'is_ac' => 'boolean',
            'insurance_expiry' => 'nullable|date',
        ]);

        Vehicle::create($validated);

        return redirect()->back()->with('success', 'Vehicle added successfully.');
    }

    public function update(Request $request, Vehicle $vehicle)
    {
        $validated = $request->validate([
            'car_category_id' => 'required|exists:car_categories,id',
            'driver_id' => ['nullable', 'exists:drivers,id', Rule::unique('vehicles', 'driver_id')->ignore($vehicle->id)],
            'registration_number' => 'required|string|unique:vehicles,registration_number,'.$vehicle->id,
            'make' => 'required|string',
            'model' => 'required|string',
            'year' => 'required|integer',
            'color' => 'required|string',
            'fuel_type' => 'required|string',
            'seats' => 'required|integer',
            'is_ac' => 'boolean',
            'insurance_expiry' => 'nullable|date',
            'is_active' => 'boolean',
            'condition' => 'string',
            'approval_status' => ['required', Rule::in(['pending', 'approved', 'rejected'])],
            'rejection_reason' => 'nullable|string|max:1000',
        ]);

        $validated['is_active'] = $validated['approval_status'] === 'approved';
        $validated['reviewed_at'] = now();
        $validated['reviewed_by'] = Auth::id();
        if ($validated['approval_status'] !== 'rejected') {
            $validated['rejection_reason'] = null;
        }

        $vehicle->update($validated);

        return redirect()->back()->with('success', 'Vehicle updated successfully.');
    }

    public function destroy(Vehicle $vehicle)
    {
        $vehicle->delete();

        return redirect()->back()->with('success', 'Vehicle removed successfully.');
    }

    public function tracking(Vehicle $vehicle)
    {
        $vehicle->load(['category', 'driver', 'tracker']);
        $tracking = $this->resolveTracking($vehicle);

        return inertia('admin/Vehicles/Tracking', [
            'title' => 'Vehicle GPS Tracking',
            'vehicle' => $vehicle,
            'tracker' => $vehicle->tracker,
            ...$tracking,
            'google_maps_api_key' => config('services.google_maps.api_key'),
        ]);
    }

    public function trackingData(Vehicle $vehicle)
    {
        $vehicle->loadMissing(['driver', 'tracker']);
        $tracking = $this->resolveTracking($vehicle);

        return response()->json([
            'tracker' => $vehicle->tracker,
            ...$tracking,
        ]);
    }

    /**
     * Prefer a live hardware tracker. If it is unavailable, use the assigned
     * driver's app location; a stale GPS fix remains the final last-known fallback.
     */
    private function resolveTracking(Vehicle $vehicle): array
    {
        return app(\App\Services\JourneyTrackingService::class)->resolve($vehicle);
    }

    public function trackingPreference(\Illuminate\Http\Request $request, Vehicle $vehicle)
    {
        $data = $request->validate(['tracking_preference' => 'required|in:automatic,driver_app,vehicle_gps']);
        $before = $vehicle->tracking_preference;
        $vehicle->update($data);
        \App\Models\BookingAuditLog::create([
            'auditable_type' => Vehicle::class, 'auditable_id' => $vehicle->id,
            'admin_id' => $request->user()->id, 'action' => 'tracking.preference.updated',
            'before' => ['tracking_preference' => $before], 'after' => $data,
        ]);

        return back()->with('success', 'Tracking source updated.');
    }

    public function provisionTracker(Request $request, Vehicle $vehicle)
    {
        $tracker = $vehicle->tracker()->firstOrCreate([], [
            'device_uid' => 'SKY-'.str_pad((string) $vehicle->id, 6, '0', STR_PAD_LEFT).'-'.Str::upper(Str::random(6)),
        ]);

        $validated = $request->validate([
            'device_uid' => [
                'nullable', 'string', 'max:100',
                Rule::unique('vehicle_trackers', 'device_uid')->ignore($tracker->id),
            ],
        ]);

        $plainToken = 'skytrk_'.Str::random(48);
        $tracker->update([
            'device_uid' => strtoupper($validated['device_uid'] ?? $tracker->device_uid),
            'token_hash' => hash('sha256', $plainToken),
            'status' => 'active',
            'installed_at' => $tracker->installed_at ?? now(),
        ]);

        return redirect()->route('admin.vehicles')->with('tracker_credentials', [
            'vehicle_id' => $vehicle->id,
            'registration_number' => $vehicle->registration_number,
            'device_uid' => $tracker->device_uid,
            'api_token' => $plainToken,
            'endpoint' => url('/api/tracker/v1/location'),
        ])->with('success', 'GPS tracker provisioned. Copy the token now; it will not be shown again.');
    }

    public function suspendTracker(Vehicle $vehicle)
    {
        $vehicle->tracker?->update(['status' => 'suspended']);

        return redirect()->back()->with('success', 'GPS tracker suspended.');
    }
}

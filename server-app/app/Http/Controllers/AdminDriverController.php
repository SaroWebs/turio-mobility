<?php

namespace App\Http\Controllers;

use App\Models\CarRental;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\DriverDocument;
use App\Models\RideBooking;
use App\Models\TourDriverAssignment;
use App\Models\Vehicle;
use App\Services\DriverVerificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminDriverController extends Controller
{
    /**
     * List all drivers with pagination and search.
     */
    public function index(Request $request)
    {
        $query = $request->boolean('deleted') ? Driver::onlyTrashed() : Driver::query();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $drivers = $query->with(['driverAvailability', 'vehicle.category'])
            ->withCount('assignedRideBookings')
            ->withCount([
                'rideReviews as ride_ratings_count' => fn ($q) => $q->whereNotNull('driver_rating'),
                'rentalReviews as rental_ratings_count' => fn ($q) => $q->whereNotNull('driver_rating'),
                'tourReviews as tour_ratings_count' => fn ($q) => $q->whereNotNull('driver_rating'),
            ])
            ->withAvg([
                'rideReviews as ride_rating_average' => fn ($q) => $q->whereNotNull('driver_rating'),
                'rentalReviews as rental_rating_average' => fn ($q) => $q->whereNotNull('driver_rating'),
                'tourReviews as tour_rating_average' => fn ($q) => $q->whereNotNull('driver_rating'),
            ], 'driver_rating')
            ->latest()
            ->paginate(15);

        $drivers->through(function (Driver $driver) {
            $this->appendRatingSummary($driver);

            return $driver;
        });

        return inertia('admin/Drivers', [
            'title' => 'Driver Management',
            'user' => Auth::user(),
            'drivers' => $drivers,
            'vehicles' => Vehicle::query()
                ->with('driver:id,name')
                ->orderBy('registration_number')
                ->get(['id', 'driver_id', 'registration_number', 'make', 'model']),
            'filters' => [
                ...$request->only(['search', 'status']),
                'deleted' => $request->boolean('deleted'),
            ],
        ]);
    }

    /**
     * Create a driver from the admin panel.
     */
    public function store(Request $request)
    {
        $validated = $this->validateDriver($request);
        if ($validated['status'] === 'active') {
            throw ValidationException::withMessages([
                'status' => 'Create the driver as pending, verify the required documents, then activate the account.',
            ]);
        }

        $driver = DB::transaction(function () use ($validated) {
            $vehicleId = $validated['vehicle_id'] ?? null;
            unset($validated['vehicle_id']);
            $driver = Driver::create($this->withStatusFields($validated));
            $this->syncAssignedVehicle($driver, $vehicleId);

            DriverAvailability::create([
                'driver_id' => $driver->id,
                'status' => 'offline',
                'is_available' => false,
                'last_updated' => now(),
            ]);

            return $driver;
        });

        return redirect()->route('admin.drivers')
            ->with('success', "Driver {$driver->name} was created successfully.");
    }

    /**
     * Update a driver from the admin panel.
     */
    public function update(Request $request, Driver $driver)
    {
        $validated = $this->validateDriver($request, $driver);
        if ($validated['status'] === 'active') {
            $this->ensureRequiredDocumentsAreApproved($driver);
        }

        DB::transaction(function () use ($validated, $driver) {
            $vehicleId = $validated['vehicle_id'] ?? null;
            unset($validated['vehicle_id']);
            $driver->update($this->withStatusFields($validated, $driver));
            $this->syncAssignedVehicle($driver, $vehicleId);

            DriverAvailability::firstOrCreate(
                ['driver_id' => $driver->id],
                ['status' => 'offline', 'is_available' => false, 'last_updated' => now()]
            );

            if (in_array($driver->status, ['suspended', 'rejected'], true)) {
                $driver->tokens()->delete();
                $driver->driverAvailability()->update([
                    'status' => 'offline',
                    'is_available' => false,
                    'last_updated' => now(),
                ]);
            }
        });

        return redirect()->route('admin.drivers')
            ->with('success', "Driver {$driver->name} was updated successfully.");
    }

    /**
     * Show driver details.
     */
    public function show(Driver $driver)
    {
        $driver->load([
            'assignedRideBookings' => fn ($q) => $q->latest()->take(15),
            'driverAvailability',
            'wallet',
            'vehicle.category',
            'vehicle.tracker',
            'documents.reviewer:id,name',
            'tourDriverAssignments.schedule.tour' => fn ($q) => $q->select('id', 'title'),
        ]);

        $stats = [
            'total_rides' => $driver->assignedRideBookings()->count(),
            'completed_rides' => $driver->assignedRideBookings()->where('status', 'completed')->count(),
            'total_earned' => $driver->assignedRideBookings()->where('status', 'completed')->sum('total_fare'),
            'wallet_balance' => $driver->wallet?->balance ?? 0,
            'is_online' => ($driver->driverAvailability?->status ?? 'offline') !== 'offline',
            'is_available' => $driver->driverAvailability?->is_available ?? false,
            'sharing_enabled' => $driver->driverAvailability?->sharing_enabled ?? false,
            'sharing_seat_capacity' => $driver->driverAvailability?->sharing_seat_capacity ?? 3,
        ];

        $this->appendRatingSummary($driver);
        $stats['average_rating'] = $driver->average_rating;
        $stats['ratings_count'] = $driver->ratings_count;

        $reviews = collect([
            $driver->rideReviews()->with(['customer:id,name', 'rideBooking:id,booking_number'])->latest()->get()
                ->map(fn ($review) => [
                    'id' => 'ride-'.$review->id,
                    'service' => 'Ride',
                    'booking_number' => $review->rideBooking?->booking_number,
                    'customer_name' => $review->customer?->name ?? 'Customer',
                    'rating' => $review->driver_rating,
                    'feedback' => $review->review,
                    'created_at' => $review->created_at?->toISOString(),
                ]),
            $driver->rentalReviews()->with(['customer:id,name', 'carRental:id,booking_number'])->latest()->get()
                ->map(fn ($review) => [
                    'id' => 'rental-'.$review->id,
                    'service' => 'Rental',
                    'booking_number' => $review->carRental?->booking_number,
                    'customer_name' => $review->customer?->name ?? 'Customer',
                    'rating' => $review->driver_rating,
                    'feedback' => $review->review,
                    'created_at' => $review->created_at?->toISOString(),
                ]),
            $driver->tourReviews()->with(['customer:id,name', 'tourBooking:id,booking_number'])->latest()->get()
                ->map(fn ($review) => [
                    'id' => 'tour-'.$review->id,
                    'service' => 'Tour',
                    'booking_number' => $review->tourBooking?->booking_number,
                    'customer_name' => $review->customer?->name ?? 'Customer',
                    'rating' => $review->driver_rating,
                    'feedback' => $review->review,
                    'created_at' => $review->created_at?->toISOString(),
                ]),
        ])->flatten(1)->sortByDesc('created_at')->take(50)->values();

        return inertia('admin/Drivers/Show', [
            'title' => 'Driver Details',
            'user' => Auth::user(),
            'driver' => $driver,
            'document_verification' => app(DriverVerificationService::class)->summary($driver),
            'verification_providers' => app(\App\Services\DocumentVerification\DocumentVerifier::class)->catalog(),
            'verification_attempts' => $driver->documents()->with('verificationAttempts')->get()->mapWithKeys(fn ($document) => [$document->id => $document->verificationAttempts]),
            'stats' => $stats,
            'reviews' => $reviews,
            'available_vehicles' => Vehicle::query()
                ->with('category:id,name')
                ->where(fn ($query) => $query->whereNull('driver_id')->orWhere('driver_id', $driver->id))
                ->orderBy('registration_number')
                ->get(),
        ]);
    }

    private function appendRatingSummary(Driver $driver): void
    {
        $sources = [
            [(int) ($driver->ride_ratings_count ?? $driver->rideReviews()->whereNotNull('driver_rating')->count()), $driver->ride_rating_average ?? $driver->rideReviews()->avg('driver_rating')],
            [(int) ($driver->rental_ratings_count ?? $driver->rentalReviews()->whereNotNull('driver_rating')->count()), $driver->rental_rating_average ?? $driver->rentalReviews()->avg('driver_rating')],
            [(int) ($driver->tour_ratings_count ?? $driver->tourReviews()->whereNotNull('driver_rating')->count()), $driver->tour_rating_average ?? $driver->tourReviews()->avg('driver_rating')],
        ];

        $count = collect($sources)->sum(fn (array $source) => $source[0]);
        $weightedTotal = collect($sources)->sum(fn (array $source) => $source[0] * (float) ($source[1] ?? 0));

        $driver->setAttribute('ratings_count', $count);
        $driver->setAttribute('average_rating', $count > 0 ? round($weightedTotal / $count, 2) : null);
    }

    /**
     * Approve a pending driver.
     */
    public function approve(Driver $driver)
    {
        $this->ensureRequiredDocumentsAreApproved($driver);

        $driver->update([
            'status' => 'active',
            'is_active' => true,
            'is_approved' => true,
            'approved_at' => now(),
            'approved_by' => Auth::id(),
        ]);

        if (request()->expectsJson() || request()->is('api/*')) {
            return response()->json([
                'message' => "Driver {$driver->name} has been approved.",
                'driver' => $driver->fresh(),
            ]);
        }

        return redirect()->back()->with('success', "Driver {$driver->name} has been approved.");
    }

    /**
     * Suspend a driver.
     */
    public function suspend(Driver $driver)
    {
        $driver->update([
            'status' => 'suspended',
            'is_active' => false,
            'is_online' => false,
        ]);

        $driver->tokens()->delete();

        DriverAvailability::where('driver_id', $driver->id)->update([
            'is_available' => false,
            'status' => 'offline',
            'last_updated' => now(),
        ]);

        if (request()->expectsJson() || request()->is('api/*')) {
            return response()->json([
                'message' => "Driver {$driver->name} has been suspended.",
                'driver' => $driver->fresh('driverAvailability'),
            ]);
        }

        return redirect()->back()->with('success', "Driver {$driver->name} has been suspended.");
    }

    /**
     * Reactivate a suspended driver.
     */
    public function activate(Driver $driver)
    {
        $this->ensureRequiredDocumentsAreApproved($driver);

        $driver->update([
            'status' => 'active',
            'is_active' => true,
            'is_approved' => true,
            'approved_at' => $driver->approved_at ?? now(),
            'approved_by' => $driver->approved_by ?? Auth::id(),
        ]);

        if (request()->expectsJson() || request()->is('api/*')) {
            return response()->json([
                'message' => "Driver {$driver->name} has been reactivated.",
                'driver' => $driver->fresh(),
            ]);
        }

        return redirect()->back()->with('success', "Driver {$driver->name} has been reactivated.");
    }

    /**
     * Assign a vehicle to this driver
     */
    public function assignVehicle(Request $request, Driver $driver)
    {
        $validated = $request->validate(['vehicle_id' => 'nullable|exists:vehicles,id']);

        DB::transaction(function () use ($validated, $driver) {
            $this->syncAssignedVehicle($driver, $validated['vehicle_id'] ?? null);
        });

        return redirect()->back()->with('success', filled($validated['vehicle_id'] ?? null)
            ? 'Vehicle assigned to driver successfully.'
            : 'Vehicle unassigned from driver successfully.');
    }

    public function reviewVehicle(Request $request, Driver $driver)
    {
        $vehicle = $driver->vehicle()->firstOrFail();
        $validated = $request->validate([
            'approval_status' => ['required', Rule::in(['approved', 'rejected', 'pending'])],
            'condition' => ['required', Rule::in(['excellent', 'good', 'fair', 'under_maintenance'])],
            'rejection_reason' => ['nullable', 'string', 'max:1000', Rule::requiredIf($request->input('approval_status') === 'rejected')],
        ]);

        $vehicle->update([
            ...$validated,
            'is_active' => $validated['approval_status'] === 'approved' && $validated['condition'] !== 'under_maintenance',
            'rejection_reason' => $validated['approval_status'] === 'rejected' ? $validated['rejection_reason'] : null,
            'reviewed_at' => now(),
            'reviewed_by' => Auth::id(),
        ]);

        return redirect()->back()->with('success', 'Driver vehicle review updated.');
    }

    public function verifyDocument(Request $request, Driver $driver, DriverDocument $document)
    {
        abort_unless($request->user()->hasPermission('verification.run_api'), 403);
        abort_unless((int) $document->driver_id === (int) $driver->id, 404);
        $validated = $request->validate([
            'provider' => ['required', 'string', 'max:100'],
            'outcome' => ['nullable', Rule::in(['approved', 'rejected', 'error'])],
        ]);
        $attempt = app(\App\Services\DocumentVerification\DocumentVerifier::class)->verify(
            $document, $validated['provider'], (int) Auth::id(), $validated['outcome'] ?? null
        );

        return redirect()->back()->with($attempt->status === 'approved' ? 'success' : 'error', $attempt->message);
    }

    public function reviewDocument(Request $request, Driver $driver, DriverDocument $document)
    {
        abort_unless((int) $document->driver_id === (int) $driver->id, 404);
        throw ValidationException::withMessages(['status' => 'Use the verification workspace to record a version-specific review decision.']);
    }

    public function destroy(Driver $driver)
    {
        $hasActiveWork = RideBooking::where('driver_id', $driver->id)
            ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
            ->exists()
            || CarRental::where('driver_id', $driver->id)
                ->whereIn('status', ['driver_assigned', 'in_progress'])
                ->exists()
            || TourDriverAssignment::where('driver_id', $driver->id)
                ->whereIn('status', ['assigned', 'accepted'])
                ->exists();

        if ($hasActiveWork) {
            throw ValidationException::withMessages([
                'driver' => 'Complete or reassign this driverâ€™s active work before deleting the account.',
            ]);
        }

        $driver->tokens()->delete();
        $driver->driverAvailability()->update([
            'status' => 'offline',
            'is_available' => false,
            'last_updated' => now(),
        ]);
        $driver->update(['is_online' => false, 'is_active' => false]);
        $driver->delete();

        return redirect()->route('admin.drivers')->with('success', 'Driver moved to deleted drivers.');
    }

    public function restore(int $driver)
    {
        $record = Driver::onlyTrashed()->findOrFail($driver);
        $record->restore();

        return redirect()->back()->with('success', 'Driver restored. Review status before activation.');
    }

    public function forceDestroy(int $driver)
    {
        $record = Driver::onlyTrashed()->findOrFail($driver);
        $documentPaths = $record->documents()->pluck('file_path')->filter()->all();
        $record->forceDelete();
        Storage::disk('public')->delete($documentPaths);

        return redirect()->back()->with('success', 'Driver permanently deleted.');
    }

    public function updateCapabilities(Request $request, Driver $driver)
    {
        $validated = $request->validate([
            'can_short_ride' => 'required|boolean',
            'can_long_ride' => 'required|boolean',
            'can_tour_lead' => 'required|boolean',
            'can_tour_transport' => 'required|boolean',
            'can_rental_delivery' => 'required|boolean',
            'languages' => 'nullable|array',
            'languages.*' => 'string|max:80',
            'expertise_tags' => 'nullable|array',
            'expertise_tags.*' => 'string|max:80',
            'certification_notes' => 'nullable|string|max:2000',
        ]);

        $driver->update($validated);

        return redirect()->back()->with('success', 'Driver capabilities updated.');
    }

    public function updateSharing(Request $request, Driver $driver)
    {
        $validated = $request->validate([
            'sharing_enabled' => 'required|boolean',
            'sharing_seat_capacity' => 'required|integer|min:2|max:6',
        ]);

        DriverAvailability::updateOrCreate(
            ['driver_id' => $driver->id],
            [
                'sharing_enabled' => $validated['sharing_enabled'],
                'sharing_seat_capacity' => $validated['sharing_seat_capacity'],
                'last_updated' => now(),
            ]
        );

        return redirect()->back()->with('success', $validated['sharing_enabled']
            ? 'Point-to-point ride sharing enabled for this driver.'
            : 'Ride sharing disabled for this driver.');
    }

    private function validateDriver(Request $request, ?Driver $driver = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => ['nullable', 'email', 'max:191', Rule::unique('drivers', 'email')->ignore($driver?->id)],
            'phone' => ['required', 'string', 'min:10', 'max:20', Rule::unique('drivers', 'phone')->ignore($driver?->id)],
            'date_of_birth' => ['nullable', 'date', 'before:today'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'license_number' => ['nullable', 'string', 'max:100'],
            'license_expiry' => ['nullable', 'date'],
            'vehicle_type' => ['nullable', 'string', 'max:100'],
            'vehicle_number' => ['nullable', 'string', 'max:50'],
            'vehicle_model' => ['nullable', 'string', 'max:100'],
            'vehicle_color' => ['nullable', 'string', 'max:50'],
            'vehicle_year' => ['nullable', 'integer', 'min:1980', 'max:'.(now()->year + 1)],
            'vehicle_id' => ['nullable', 'integer', 'exists:vehicles,id'],
            'status' => ['required', Rule::in(['pending', 'active', 'suspended', 'rejected'])],
            'can_short_ride' => ['required', 'boolean'],
            'can_long_ride' => ['required', 'boolean'],
            'can_tour_lead' => ['required', 'boolean'],
            'can_tour_transport' => ['required', 'boolean'],
            'can_rental_delivery' => ['required', 'boolean'],
        ]);
    }

    private function withStatusFields(array $validated, ?Driver $driver = null): array
    {
        $status = $validated['status'];
        $validated['is_active'] = ! in_array($status, ['suspended', 'rejected'], true);
        $validated['is_online'] = $status === 'active' ? (bool) ($driver?->is_online ?? false) : false;

        if ($status === 'active') {
            $validated['is_approved'] = true;
            $validated['approved_at'] = $driver?->approved_at ?? now();
            $validated['approved_by'] = $driver?->approved_by ?? Auth::id();
        } elseif ($status !== 'suspended') {
            $validated['is_approved'] = false;
            $validated['approved_at'] = null;
            $validated['approved_by'] = null;
        }

        return $validated;
    }

    private function syncAssignedVehicle(Driver $driver, ?int $vehicleId): void
    {
        $vehicle = $vehicleId ? Vehicle::lockForUpdate()->findOrFail($vehicleId) : null;

        if ($vehicle?->driver_id && $vehicle->driver_id !== $driver->id) {
            throw ValidationException::withMessages([
                'vehicle_id' => 'This vehicle is already assigned to another driver. Unassign it first.',
            ]);
        }

        Vehicle::where('driver_id', $driver->id)
            ->when($vehicle, fn ($query) => $query->whereKeyNot($vehicle->id))
            ->update(['driver_id' => null]);

        $vehicle?->update(['driver_id' => $driver->id]);
    }

    private function ensureRequiredDocumentsAreApproved(Driver $driver): void
    {
        $missing = collect(app(DriverVerificationService::class)->summary($driver)['missing_or_unverified']);

        if ($missing->isNotEmpty()) {
            throw ValidationException::withMessages([
                'documents' => 'Approve all required, unexpired driver documents first: '
                    .$missing->map(fn (string $type) => DriverVerificationService::DOCUMENTS[$type]['label'])->join(', ')
                    .'.',
            ]);
        }
    }
}

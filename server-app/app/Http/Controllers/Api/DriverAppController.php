<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\DriverAvailability;
use App\Models\RideBooking;
use App\Models\TourBooking;
use App\Models\TourDriverAssignment;
use App\Models\Vehicle;
use App\Rules\FileIsClean;
use App\Services\BookingLifecycleNotifier;
use App\Services\CommissionService;
use App\Services\DriverDispatchService;
use App\Services\DriverVerificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class DriverAppController extends Controller
{
    public function dashboard(Request $request)
    {
        $driver = $request->user();
        $availability = DriverAvailability::firstOrCreate(
            ['driver_id' => $driver->id],
            ['status' => 'offline', 'is_available' => true]
        );
        $vehicle = $driver->vehicle()->with('category:id,name,vehicle_type,seats,base_fare,price_per_km,price_per_minute,min_fare,base_price_per_day,extra_km_charge')->first();

        return response()->json([
            'success' => true,
            'driver' => $driver,
            'availability' => $availability,
            'vehicle' => $vehicle,
            'vehicle_readiness' => $this->vehicleReadiness($vehicle, $driver),
            'document_verification' => $this->documentVerification($driver),
            'wallet' => [
                'balance_minor' => $driver->getWalletBalanceMinor(),
                'balance' => round($driver->getWalletBalanceMinor() / 100, 2),
                'minimum_topup_minor' => (int) setting('driver.minimum_topup_minor', 50000),
                'dispatch_eligible_balance_minor' => (int) setting('driver.dispatch_eligible_balance_minor', 10000),
                'warning_balance_minor' => (int) setting('driver.warning_balance_minor', 50000),
                'needs_topup_warning' => $driver->getWalletBalanceMinor() < (int) setting('driver.warning_balance_minor', 50000),
                'is_dispatch_eligible' => $driver->getWalletBalanceMinor() >= (int) setting('driver.dispatch_eligible_balance_minor', 10000),
            ],
            'stats' => [
                'active_rides' => RideBooking::where('driver_id', $driver->id)
                    ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
                    ->count(),
                'completed_rides' => RideBooking::where('driver_id', $driver->id)
                    ->where('status', 'completed')
                    ->count(),
                'pending_pool' => RideBooking::whereNull('driver_id')
                    ->whereIn('status', ['pending', 'confirmed'])
                    ->count(),
                'tour_assignments' => TourDriverAssignment::where('driver_id', $driver->id)
                    ->whereIn('status', ['assigned', 'accepted'])
                    ->count(),
                'rental_assignments' => CarRental::where('driver_id', $driver->id)
                    ->whereIn('status', ['driver_assigned', 'in_progress'])
                    ->count(),
                'earnings' => (float) RideBooking::where('driver_id', $driver->id)
                    ->where('status', 'completed')
                    ->sum('driver_share'),
            ],
            'active_ride' => RideBooking::with('customer:id,name,phone')
                ->where('driver_id', $driver->id)
                ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
                ->latest()
                ->first(),
            'tour_assignments' => TourDriverAssignment::with(['schedule.tour.itineraries', 'vehicle', 'bookings.customer:id,name,phone'])
                ->where('driver_id', $driver->id)
                ->whereIn('status', ['assigned', 'accepted'])
                ->latest()
                ->take(5)
                ->get(),
            'rental_assignments' => CarRental::with(['customer:id,name,phone', 'carCategory'])
                ->where('driver_id', $driver->id)
                ->whereIn('status', ['driver_assigned', 'in_progress'])
                ->latest()
                ->take(5)
                ->get(),
            'recent_rides' => RideBooking::with('customer:id,name,phone')
                ->where('driver_id', $driver->id)
                ->latest()
                ->take(5)
                ->get(),
        ]);
    }

    public function updateAvailability(Request $request)
    {
        $validated = $request->validate([
            'is_online' => 'required|boolean',
            'is_available' => 'required|boolean',
            'vehicle_type' => 'nullable|string|max:100',
            'vehicle_number' => 'nullable|string|max:100',
            'sharing_enabled' => 'sometimes|boolean',
            'sharing_seat_capacity' => 'sometimes|integer|min:2|max:6',
        ]);

        if ($validated['is_online']) {
            $dispatchEligibleMinor = (int) setting('driver.dispatch_eligible_balance_minor', 10000);
            $driverBalanceMinor = $request->user()->getWalletBalanceMinor();
            if ($driverBalanceMinor < $dispatchEligibleMinor) {
                return response()->json([
                    'success' => false,
                    'message' => 'Wallet balance is below ₹'.($dispatchEligibleMinor / 100).'. Please top up your wallet to go online and pick rides.',
                    'balance_minor' => $driverBalanceMinor,
                    'minimum_required_minor' => $dispatchEligibleMinor,
                ], 422);
            }

            $vehicle = $request->user()->vehicle()->first();
            $readiness = $this->vehicleReadiness($vehicle, $request->user());

            if (! $readiness['can_go_online']) {
                return response()->json([
                    'success' => false,
                    'message' => $readiness['message'],
                    'vehicle_readiness' => $readiness,
                ], 422);
            }
        }

        $availability = DriverAvailability::updateOrCreate(
            ['driver_id' => $request->user()->id],
            [
                'is_available' => $validated['is_available'],
                'status' => $validated['is_online'] ? 'online' : 'offline',
                'sharing_enabled' => $validated['sharing_enabled']
                    ?? $request->user()->driverAvailability?->sharing_enabled
                    ?? false,
                'sharing_seat_capacity' => $validated['sharing_seat_capacity']
                    ?? $request->user()->driverAvailability?->sharing_seat_capacity
                    ?? 3,
                'last_updated' => now(),
            ]
        );

        $request->user()->update([
            'is_online' => $validated['is_online'],
            'vehicle_type' => $validated['vehicle_type'] ?? $request->user()->vehicle_type,
            'vehicle_number' => $validated['vehicle_number'] ?? $request->user()->vehicle_number,
        ]);

        return response()->json([
            'success' => true,
            'data' => $availability,
        ]);
    }

    public function vehicle(Request $request)
    {
        $vehicle = $request->user()->vehicle()->with('category:id,name,vehicle_type,seats,base_fare,price_per_km,price_per_minute,min_fare,base_price_per_day,extra_km_charge')->first();

        return response()->json([
            'success' => true,
            'setup_options' => array_merge(config('vehicle_catalog'), ['years' => range(now()->year + 1, 1980)]),
            'vehicle' => $vehicle,
            'vehicle_readiness' => $this->vehicleReadiness($vehicle, $request->user()),
            'document_verification' => $this->documentVerification($request->user()),
            'categories' => CarCategory::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get([
                    'id', 'name', 'vehicle_type', 'seats',
                    'base_fare', 'price_per_km', 'price_per_minute', 'min_fare',
                    'base_price_per_day', 'extra_km_charge',
                ]),
        ]);
    }

    public function documents(Request $request)
    {
        $documents = $request->user()->documents()->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $documents,
            'verification' => $this->documentVerification($request->user()),
        ]);
    }

    public function upsertDocument(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(array_unique(array_merge(array_keys(DriverVerificationService::DOCUMENTS), app(\App\Services\Verification\RequirementPolicy::class)->forDriver($request->user())->flatMap(fn ($r) => [$r->type, ...($r->alternative_types ?? [])])->all())))],
            'document_number' => ['nullable', 'string', 'max:120', Rule::prohibitedIf(in_array($request->input('type'), ['government_id', 'aadhaar'], true))],
            'expires_at' => ['nullable', 'date', 'after_or_equal:today'],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240', new FileIsClean],
            'consent' => ['required', 'accepted'],
        ]);

        $document = app(\App\Services\Verification\DocumentWorkflow::class)->submit($request->user(), $validated, $request->file('file'));

        return response()->json([
            'success' => true,
            'message' => 'Document submitted for verification.',
            'data' => $document,
            'verification' => $this->documentVerification($request->user()),
        ]);
    }

    public function upsertVehicle(Request $request)
    {
        $driver = $request->user();
        $vehicle = $driver->vehicle()->first();

        // Normalize before uniqueness validation, not after it.
        if (is_string($request->input('registration_number'))) {
            $request->merge(['registration_number' => strtoupper(preg_replace('/[\s-]+/', '', $request->input('registration_number')))]);
        }

        $hasActiveWork = RideBooking::query()
            ->where('driver_id', $driver->id)
            ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
            ->exists();

        if ($hasActiveWork) {
            return response()->json([
                'success' => false,
                'message' => 'Finish your active ride before editing your car.',
            ], 409);
        }

        $validated = $request->validate([
            'car_category_id' => ['required', Rule::exists('car_categories', 'id')->where('is_active', true)],
            'registration_number' => [
                'required', 'string', 'max:30',
                Rule::unique('vehicles', 'registration_number')->ignore($vehicle?->id),
            ],
            'make' => ['required', 'string', 'max:100'],
            'model' => ['required', 'string', 'max:100'],
            'year' => ['required', 'integer', 'min:1980', 'max:'.(now()->year + 1)],
            'color' => ['required', 'string', 'max:50'],
            'fuel_type' => ['required', Rule::in(['petrol', 'diesel', 'cng', 'electric', 'hybrid'])],
            'seats' => ['required', 'integer', 'min:2', 'max:12'],
            'is_ac' => ['required', 'boolean'],
            'insurance_expiry' => ['nullable', 'date'],
            'permit_expiry' => ['nullable', 'date'],
            'fitness_expiry' => ['nullable', 'date'],
            'pollution_expiry' => ['nullable', 'date'],
            'photos' => ['sometimes', 'array:front,rear,left,right'],
            'photos.front' => [$vehicle ? 'sometimes' : 'required_with:photos', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240', new FileIsClean],
            'photos.rear' => [$vehicle ? 'sometimes' : 'required_with:photos', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240', new FileIsClean],
            'photos.left' => [$vehicle ? 'sometimes' : 'required_with:photos', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240', new FileIsClean],
            'photos.right' => [$vehicle ? 'sometimes' : 'required_with:photos', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240', new FileIsClean],
        ]);

        $uploads = $validated['photos'] ?? [];
        unset($validated['photos']);

        if ($vehicle && ! $uploads && ! (clone $vehicle)->fill($validated)->isDirty()) {
            return response()->json([
                'success' => true,
                'message' => 'Your car details are already saved. Review status has not changed.',
                'vehicle' => $vehicle->load('category'),
                'vehicle_readiness' => $this->vehicleReadiness($vehicle, $driver),
            ]);
        }

        $validated['driver_id'] = $driver->id;
        $validated['is_active'] = false;
        $validated['is_available_for_rent'] = false;
        $validated['approval_status'] = 'pending';
        $validated['reviewed_at'] = null;
        $validated['reviewed_by'] = null;
        $validated['rejection_reason'] = null;

        $oldPhotos = $vehicle?->photos ?? [];
        $storedPhotos = [];
        try {
            foreach ($uploads as $side => $photo) {
                $path = $photo->store('vehicle-photos/'.$driver->id, 'public');
                if (! $path) {
                    throw new \RuntimeException('Could not store vehicle photo.');
                }
                $storedPhotos[$side] = $path;
            }
            if ($storedPhotos) {
                $validated['photos'] = array_replace($oldPhotos, $storedPhotos);
            }

            $vehicle = DB::transaction(function () use ($driver, $validated) {
                $vehicle = Vehicle::updateOrCreate(['driver_id' => $driver->id], $validated);
                $category = CarCategory::find($validated['car_category_id']);

                $driver->update([
                    'vehicle_type' => $category?->vehicle_type,
                    'vehicle_number' => $vehicle->registration_number,
                    'vehicle_model' => trim($vehicle->make.' '.$vehicle->model),
                    'vehicle_color' => $vehicle->color,
                    'vehicle_year' => $vehicle->year,
                    'is_online' => false,
                ]);

                DriverAvailability::where('driver_id', $driver->id)->update([
                    'status' => 'offline',
                    'is_available' => false,
                    'last_updated' => now(),
                ]);

                return $vehicle;
            });
        } catch (\Throwable $error) {
            Storage::disk('public')->delete(array_values($storedPhotos));
            throw $error;
        }

        // Delete replaced files only after the database changes have committed.
        foreach (array_keys($storedPhotos) as $side) {
            if (isset($oldPhotos[$side])) {
                Storage::disk('public')->delete($oldPhotos[$side]);
            }
        }

        $vehicle->load('category:id,name,vehicle_type,seats,base_fare,price_per_km,price_per_minute,min_fare,base_price_per_day,extra_km_charge');

        return response()->json([
            'success' => true,
            'message' => 'Your car was submitted for admin approval.',
            'vehicle' => $vehicle,
            'vehicle_readiness' => $this->vehicleReadiness($vehicle, $driver),
        ]);
    }

    public function updateRentalAvailability(Request $request)
    {
        $validated = $request->validate([
            'is_available_for_rent' => ['required', 'boolean'],
        ]);

        $driver = $request->user();
        $vehicle = $driver->vehicle()->first();
        if (! $vehicle) {
            return response()->json([
                'success' => false,
                'message' => 'Add and verify your vehicle before listing it for rent.',
            ], 422);
        }

        $availableForRent = (bool) $validated['is_available_for_rent'];
        if ($availableForRent && (
            ! $driver->can_rental_delivery
            || ! $this->documentVerification($driver)['is_complete']
            || $driver->status !== 'active'
            || ! $driver->is_active
            || ! $driver->is_approved
            || ! $vehicle->isApprovedForService()
        )) {
            return response()->json([
                'success' => false,
                'message' => 'Your driver account and vehicle must be approved before the car can be listed for rent.',
            ], 422);
        }

        $vehicle->update(['is_available_for_rent' => $availableForRent]);

        return response()->json([
            'success' => true,
            'message' => $availableForRent
                ? 'Your vehicle is now visible in car rentals.'
                : 'Your vehicle has been removed from car rentals.',
            'vehicle' => $vehicle->fresh('category'),
        ]);
    }

    private function vehicleReadiness(?Vehicle $vehicle, $driver = null): array
    {
        if (! $vehicle) {
            return [
                'status' => 'missing',
                'can_go_online' => false,
                'message' => 'Add your car before going online.',
            ];
        }

        $verification = $driver ? $this->documentVerification($driver) : null;
        if ($verification && ! $verification['is_complete']) {
            return [
                'status' => $verification['status'] === 'in_review' ? 'documents_pending' : 'documents_required',
                'can_go_online' => false,
                'message' => $verification['message'],
                'action' => 'documents',
            ];
        }

        if ($driver && ($driver->status !== 'active' || ! $driver->is_approved || ! $driver->is_active)) {
            return [
                'status' => 'driver_pending',
                'can_go_online' => false,
                'message' => 'Your driver profile is waiting for admin activation.',
            ];
        }

        if ($vehicle->approval_status === 'rejected') {
            return [
                'status' => 'rejected',
                'can_go_online' => false,
                'message' => $vehicle->rejection_reason ?: 'Your car was rejected. Update its details and submit again.',
            ];
        }

        if ($vehicle->approval_status !== 'approved' || ! $vehicle->is_active) {
            return [
                'status' => 'pending',
                'can_go_online' => false,
                'message' => 'Your car is waiting for admin approval.',
            ];
        }

        if (! $vehicle->isDocumentValid() || $vehicle->condition === 'under_maintenance') {
            return [
                'status' => 'unavailable',
                'can_go_online' => false,
                'message' => 'Your car is not service-ready. Check documents and maintenance status.',
            ];
        }

        return [
            'status' => 'approved',
            'can_go_online' => true,
            'message' => 'Your car is approved and ready for trips.',
        ];
    }

    private function documentVerification($driver): array
    {
        return app(DriverVerificationService::class)->summary($driver);
    }

    public function history(Request $request)
    {
        $rides = RideBooking::with(['customer:id,name,phone'])
            ->where('driver_id', $request->user()->id)
            ->latest()
            ->paginate(20);

        $rides->getCollection()->transform(function (RideBooking $ride) {
            if ($ride->commission_amount === null && (float) $ride->total_fare > 0) {
                $ride->commission_amount = app(\App\Services\CommissionService::class)->calculateRideCommission($ride);
            }
            if ($ride->driver_share === null && (float) $ride->total_fare > 0) {
                $ride->driver_share = max(0, round((float) $ride->total_fare - (float) $ride->commission_amount, 2));
            }

            return $ride;
        });

        return response()->json([
            'success' => true,
            'data' => $rides,
        ]);
    }

    public function historyDetail(Request $request, string $kind, int $id)
    {
        $driverId = $request->user()->id;

        $record = match ($kind) {
            'ride' => RideBooking::with(['customer:id,name,phone'])
                ->where('driver_id', $driverId)
                ->findOrFail($id),
            'tour' => TourDriverAssignment::with([
                'schedule.tour.itineraries',
                'vehicle',
                'bookings.customer:id,name,phone',
            ])->where('driver_id', $driverId)->findOrFail($id),
            'rental' => CarRental::with(['customer:id,name,phone', 'carCategory', 'vehicle'])
                ->where('driver_id', $driverId)
                ->findOrFail($id),
        };

        if ($kind === 'ride' && $record instanceof RideBooking) {
            if ($record->commission_amount === null && (float) $record->total_fare > 0) {
                $record->commission_amount = app(\App\Services\CommissionService::class)->calculateRideCommission($record);
            }
            if ($record->driver_share === null && (float) $record->total_fare > 0) {
                $record->driver_share = max(0, round((float) $record->total_fare - (float) $record->commission_amount, 2));
            }
        }

        return response()->json([
            'success' => true,
            'kind' => $kind,
            'data' => $record,
        ]);
    }

    public function tourAssignments(Request $request)
    {
        $assignments = TourDriverAssignment::with(['schedule.tour.itineraries', 'vehicle', 'bookings.customer:id,name,phone'])
            ->where('driver_id', $request->user()->id)
            ->latest()
            ->paginate(20);

        return response()->json(['success' => true, 'data' => $assignments]);
    }

    public function tourCashSummary(Request $request, TourDriverAssignment $assignment)
    {
        abort_unless((int) $assignment->driver_id === $request->user()->id, 403, 'Unauthorized.');

        $bookings = $assignment->bookings()->with('customer:id,name,phone')->get();
        $settlementService = app(\App\Services\TourSettlementService::class);

        $summary = $bookings->map(function ($booking) use ($settlementService) {
            return [
                'booking_id' => $booking->id,
                'booking_number' => $booking->booking_number,
                'customer' => $booking->customer,
                'payment_status' => $booking->payment_status,
                'remaining_cash_minor' => $settlementService->remainingCashMinor($booking),
                'cash_collected_minor' => $settlementService->cashCollectedMinor($booking),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'assignment_id' => $assignment->id,
                'total_remaining_cash_minor' => $summary->sum('remaining_cash_minor'),
                'bookings' => $summary,
            ],
        ]);
    }

    public function collectTourCash(Request $request, TourBooking $booking)
    {
        abort_unless(is_string($request->header('Idempotency-Key')) && strlen($request->header('Idempotency-Key')) >= 8 && strlen($request->header('Idempotency-Key')) <= 128, 422, 'A stable cash collection request key is required.');
        $validated = $request->validate([
            'amount_minor' => 'required|integer|min:1',
            'evidence' => 'required|string|max:255',
        ]);

        $payment = app(\App\Services\PaymentService::class)->recordTourCashCollection(
            $booking,
            $request->user()->id,
            $validated['amount_minor'],
            $validated['evidence'],
            $request->header('Idempotency-Key')
        );

        return response()->json([
            'success' => true,
            'message' => 'Cash collection recorded successfully.',
            'data' => $payment,
        ]);
    }

    public function acceptTourAssignment(Request $request, int $id)
    {
        return $this->updateTourAssignment($request, $id, 'accepted');
    }

    public function declineTourAssignment(Request $request, int $id)
    {
        return $this->updateTourAssignment($request, $id, 'declined');
    }

    public function completeTourAssignment(Request $request, int $id)
    {
        return $this->updateTourAssignment($request, $id, 'completed');
    }

    public function rentalAssignments(Request $request)
    {
        $rentals = CarRental::with(['customer:id,name,phone', 'carCategory', 'vehicle'])
            ->where('driver_id', $request->user()->id)
            ->latest()
            ->paginate(20);

        return response()->json(['success' => true, 'data' => $rentals]);
    }

    public function activeRental(Request $request)
    {
        $rental = CarRental::with(['customer:id,name,phone', 'carCategory', 'vehicle'])
            ->where('driver_id', $request->user()->id)
            ->whereIn('status', ['driver_assigned', 'in_progress'])
            ->latest()
            ->first();

        return response()->json(['success' => true, 'data' => $rental]);
    }

    public function acceptRental(Request $request, CarRental $rental)
    {
        return $this->updateRental($request, $rental, 'driver_assigned', 'Rental accepted successfully.');
    }

    public function declineRental(Request $request, CarRental $rental)
    {
        return $this->updateRental($request, $rental, 'pending', 'Rental declined.');
    }

    public function completeRental(Request $request, CarRental $rental)
    {
        return $this->updateRental($request, $rental, 'completed', 'Rental completed.');
    }

    public function markNoShow(Request $request, TourBooking $booking)
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        abort_unless(
            $booking->driverAssignments()->where('driver_id', $request->user()->id)->where('status', 'accepted')->whereIn('role', ['transport', 'both'])->exists(),
            403,
            'You are not assigned to this tour.'
        );

        try {
            app(\App\Services\TourAttendanceService::class)->markNoShow(
                $booking,
                'driver',
                $validated['reason'] ?? null
            );

            return response()->json([
                'success' => true,
                'message' => 'Customer marked as no-show.',
                'data' => $booking->fresh(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function assignmentAttendance(Request $request, TourDriverAssignment $assignment)
    {
        abort_unless((int) $assignment->driver_id === $request->user()->id, 403, 'Unauthorized.');

        $bookings = $assignment->bookings()->with('customer:id,name,phone')->get();
        $attendance = $bookings->map(function ($booking) {
            return [
                'booking_id' => $booking->id,
                'booking_number' => $booking->booking_number,
                'customer' => $booking->customer,
                'attendance_status' => $booking->attendance_status,
                'waiting_started_at' => $booking->waiting_started_at,
                'waiting_deadline_at' => $booking->waiting_deadline_at,
                'joined_at' => $booking->joined_at,
                'no_show_at' => $booking->no_show_at,
                'no_show_review_status' => $booking->no_show_review_status,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $attendance,
        ]);
    }

    private function updateTourAssignment(Request $request, int $id, string $status)
    {
        $assignment = TourDriverAssignment::with('schedule')
            ->where('driver_id', $request->user()->id)
            ->findOrFail($id);

        if ($assignment->status === $status) {
            return response()->json(['success' => true, 'data' => $assignment->load('bookings.customer')]);
        }
        abort_unless(in_array($status, match ($assignment->status) {
            'assigned' => ['accepted', 'declined'], 'accepted' => ['completed'], default => []
        }), 409, 'Invalid assignment transition.');
        if ($status === 'accepted') {
            $failures = app(DriverDispatchService::class)->eligibilityFailures(
                $request->user(),
                'tour',
                $assignment->role ?? 'transport',
                null,
                $assignment->vehicle_id ? (int) $assignment->vehicle_id : null,
                excludeTourAssignmentId: $assignment->id
            );

            if ($failures !== []) {
                return response()->json([
                    'success' => false,
                    'message' => 'Complete your current ride, rental, or tour before accepting this tour.',
                    'errors' => ['engagement' => $failures],
                ], 409);
            }
        }

        DB::transaction(function () use ($assignment, $request, $status) {
            $locked = TourDriverAssignment::lockForUpdate()->findOrFail($assignment->id);
            abort_unless($locked->status === $assignment->status, 409, 'Assignment changed; refresh.');
            app(\App\Services\ResourceCommitmentService::class)->lockResources($request->user()->id, $locked->vehicle_id);
            if ($status === 'completed') {
                $incomplete = $locked->bookings()
                    ->whereNotIn('status', ['completed', 'cancelled'])
                    ->where(fn ($q) => $q->whereNull('attendance_status')->orWhere('attendance_status', '!=', 'no_show'))
                    ->exists();
                abort_if($incomplete, 409, 'Complete all passenger bookings or mark as no-show before closing this assignment.');
            }
            if ($status === 'accepted') {
                abort_unless(app(\App\Services\DriverFundingPolicy::class)->eligible($request->user()), 409, 'Driver funding requirements are not met.');
                abort_if(app(DriverDispatchService::class)->hasActiveWorkload($request->user(), $locked->id), 409, 'Driver is already engaged.');
                $schedule = $locked->schedule;
                if ($schedule) {
                    $conflicts = app(\App\Services\ResourceCommitmentService::class)->findConflicts(
                        $request->user()->id,
                        $locked->vehicle_id,
                        $schedule->departure_date,
                        $schedule->return_date ?? $schedule->departure_date,
                        ['exclude_tour_assignment_id' => $locked->id, 'exclude_tour_schedule_id' => $schedule->id]
                    );
                    abort_if(! empty($conflicts), 409, implode(' ', $conflicts));
                }
            }
            $locked->update(['status' => $status]);
        });

        if ($status === 'accepted') {
            DriverAvailability::where('driver_id', $request->user()->id)->update([
                'status' => 'on_tour',
                'is_available' => false,
                'last_updated' => now(),
            ]);
        } elseif (in_array($status, ['declined', 'completed'], true)) {
            $stillEngaged = app(DriverDispatchService::class)->hasActiveWorkload($request->user());
            DriverAvailability::where('driver_id', $request->user()->id)->update([
                'status' => $stillEngaged ? 'on_ride' : 'online',
                'is_available' => ! $stillEngaged,
                'last_updated' => now(),
            ]);
        }

        $action = match ($status) {
            'accepted' => 'booking.accepted',
            'declined' => 'booking.declined',
            'completed' => null,
            default => null,
        };

        if ($action) {
            TourBooking::with('customer')
                ->where('tour_schedule_id', $assignment->tour_schedule_id)
                ->get()
                ->each(fn (TourBooking $booking) => app(BookingLifecycleNotifier::class)->emit($booking, $action, [
                    'driver_id' => $request->user()->id,
                    'assignment_id' => $assignment->id,
                ]));
        }

        return response()->json(['success' => true, 'data' => $assignment->fresh(['schedule.tour.itineraries', 'vehicle', 'bookings.customer:id,name,phone'])]);
    }

    private function updateRental(Request $request, CarRental $rental, string $status, string $message)
    {
        Gate::authorize('updateAssignment', $rental);

        DB::transaction(function () use ($request, $rental, $status) {
            $locked = CarRental::lockForUpdate()->findOrFail($rental->id);
            app(\App\Services\ResourceCommitmentService::class)->lockResources($request->user()->id, $locked->vehicle_id);

            if ($status === 'driver_assigned') {
                $conflicts = app(\App\Services\ResourceCommitmentService::class)->findConflicts(
                    $request->user()->id,
                    $locked->vehicle_id,
                    $locked->start_date,
                    $locked->end_date,
                    ['exclude_car_rental_id' => $locked->id]
                );
                abort_if(! empty($conflicts), 409, implode(' ', $conflicts));
            }

            $updates = ['status' => $status];
            if ($status === 'pending') {
                $updates['driver_id'] = null;
                $updates['vehicle_id'] = null;
            }
            $locked->update($updates);
            if ($status === 'completed' && $locked->fresh()->payment_status === 'paid') {
                app(CommissionService::class)->settleRental($locked->fresh());
            }

            DriverAvailability::where('driver_id', $request->user()->id)->update([
                'status' => $status === 'completed' || $status === 'pending' ? 'online' : 'on_ride',
                'is_available' => $status === 'completed' || $status === 'pending',
                'last_updated' => now(),
            ]);
        });

        $action = match ($status) {
            'driver_assigned' => 'booking.accepted',
            'pending' => 'booking.declined',
            'completed' => 'booking.completed',
            default => null,
        };

        if ($action) {
            app(BookingLifecycleNotifier::class)->emit($rental->fresh('customer'), $action, [
                'driver_id' => $request->user()->id,
            ]);
        }

        return response()->json(['success' => true, 'message' => $message, 'data' => $rental->fresh()]);
    }

    public function carRentalChecklists(Request $request, CarRental $carRental)
    {
        Gate::authorize('track', $carRental);

        return response()->json([
            'success' => true,
            'data' => $carRental->checklists,
        ]);
    }

    public function submitCarRentalChecklist(Request $request, CarRental $carRental)
    {
        Gate::authorize('track', $carRental);

        $validated = $request->validate([
            'type' => 'required|in:handover,return',
            'odometer_reading' => 'nullable|numeric',
            'fuel_level_percent' => 'nullable|integer|min:0|max:100',
            'cleanliness' => 'nullable|in:clean,moderate,dirty',
            'checklist_items' => 'nullable|array',
            'photos' => 'nullable|array',
            'damage_detected' => 'nullable|boolean',
            'damage_notes' => 'nullable|string',
            'customer_acknowledged' => 'nullable|boolean',
        ]);

        $checklist = app(\App\Services\RentalChecklistService::class)->submitChecklist(
            $carRental,
            $validated['type'],
            $validated,
            'driver',
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Checklist submitted successfully.',
            'data' => $checklist,
        ]);
    }
}

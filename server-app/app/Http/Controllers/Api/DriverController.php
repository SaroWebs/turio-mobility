<?php

namespace App\Http\Controllers\Api;

use App\Events\RideAssigned;
use App\Events\RideStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\DriverAvailability;
use App\Models\RideBooking;
use App\Services\BookingLifecycleNotifier;
use App\Services\DriverDispatchService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DriverController extends Controller
{
    public function activeRide(Request $request)
    {
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $ride = app(\App\Services\SharedTripService::class)->nextRide($user->id) ?? RideBooking::query()
            ->where('driver_id', $user->id)
            ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
            ->with('customer:id,name,phone')
            ->orderByDesc('updated_at')
            ->first();

        return response()->json([
            'success' => true,
            'ride' => $ride ? $this->mapRide($ride) : null,
        ]);
    }

    public function pendingRides(Request $request)
    {
        app(\App\Services\RideRequestLifecycle::class)->expire();
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $availability = DriverAvailability::where('driver_id', $user->id)->first();

        $query = RideBooking::query()
            ->where('scheduled_at', '<=', now()->addMinutes((int) setting('ride.dispatch.window_minutes', 15)))
            ->where(function ($query) use ($user) {
                $query->whereHas('dispatchAttempts', function ($attempts) use ($user) {
                    $attempts->where('driver_id', $user->id)
                        ->where('status', 'offered')
                        ->where(function ($expiry) {
                            $expiry->whereNull('expires_at')
                                ->orWhere('expires_at', '>', now());
                        });
                })->orWhere(function ($pool) use ($user) {
                    $pool->whereNull('driver_id')
                        ->whereDoesntHave('dispatchAttempts', function ($attempts) use ($user) {
                            $attempts->where('driver_id', $user->id)
                                ->whereIn('status', ['declined', 'expired', 'superseded']);
                        });
                });
            })
            ->whereIn('status', ['pending', 'confirmed'])
            ->with('customer:id,name,phone')
            ->orderBy('scheduled_at')
            ->limit(25);

        if ($availability?->current_lat && $availability?->current_lng) {
            $lat = (float) $availability->current_lat;
            $lng = (float) $availability->current_lng;
            $radiusKm = (float) setting('ride.dispatch.pickup_radius_km', DriverDispatchService::DEFAULT_PICKUP_RADIUS_KM, [
                'lat' => $lat,
                'lng' => $lng,
            ]);

            $latDelta = $radiusKm / 111.32;
            $lngDelta = $radiusKm / (111.32 * cos(deg2rad($lat)));

            $query->whereBetween('pickup_lat', [$lat - $latDelta, $lat + $latDelta])
                ->whereBetween('pickup_lng', [$lng - $lngDelta, $lng + $lngDelta]);
        }

        $dispatch = app(DriverDispatchService::class);
        $vehicle = $user->vehicle()->first();
        $rides = $query->get()
            ->filter(function (RideBooking $ride) use ($dispatch, $user, $vehicle) {
                return $dispatch->eligibilityFailures(
                    $user,
                    $dispatch->rideServiceType($ride),
                    null,
                    $ride->car_category_id,
                    $vehicle?->id,
                    $ride->pickup_lat !== null ? (float) $ride->pickup_lat : null,
                    $ride->pickup_lng !== null ? (float) $ride->pickup_lng : null
                ) === [];
            })
            ->map(fn (RideBooking $ride) => $this->mapRide($ride))
            ->values();

        return response()->json([
            'success' => true,
            'rides' => $rides,
        ]);
    }

    public function acceptRide(Request $request, RideBooking $booking)
    {
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        if (! in_array($booking->status, ['pending', 'confirmed'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'This ride is not available to accept.',
            ], 409);
        }

        $hasActiveRide = RideBooking::query()
            ->where('driver_id', $user->id)
            ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
            ->exists();

        if ($hasActiveRide) {
            return response()->json([
                'success' => false,
                'message' => 'Complete your active ride before accepting a new one.',
            ], 409);
        }

        $vehicle = $user->vehicle()->first();
        $dispatch = app(DriverDispatchService::class);
        $eligibilityFailures = $dispatch->eligibilityFailures(
            $user,
            $dispatch->rideServiceType($booking),
            null,
            $booking->car_category_id,
            $vehicle?->id,
            $booking->pickup_lat !== null ? (float) $booking->pickup_lat : null,
            $booking->pickup_lng !== null ? (float) $booking->pickup_lng : null,
            null,
            null,
            $booking
        );

        if ($eligibilityFailures !== []) {
            return response()->json([
                'success' => false,
                'message' => $eligibilityFailures[0],
                'errors' => ['eligibility' => $eligibilityFailures],
            ], 422);
        }

        $accepted = false;

        DB::transaction(function () use ($booking, $user, $vehicle, &$accepted) {
            app(\App\Services\ResourceCommitmentService::class)->lockResources($user->id, $vehicle?->id);
            \App\Models\Customer::whereKey($booking->customer_id)->lockForUpdate()->firstOrFail();
            if (RideBooking::where('customer_id', $booking->customer_id)->whereKeyNot($booking->id)
                ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])->exists()) {
                return;
            }
            if (app(DriverDispatchService::class)->hasActiveWorkload($user)) {
                return;
            }
            $locked = RideBooking::whereKey($booking->id)->lockForUpdate()->first();

            if (! $locked || $locked->scheduled_at->gt(now()->addMinutes((int) setting('ride.dispatch.window_minutes', 15))) || ($locked->request_expires_at && $locked->request_expires_at->lte(now())) || $locked->driver_id || ! in_array($locked->status, ['pending', 'confirmed'], true)) {
                return;
            }

            $commitmentService = app(\App\Services\ResourceCommitmentService::class);
            $rideInterval = $commitmentService->getRideInterval($locked);
            $conflicts = $commitmentService->findConflicts(
                $user->id,
                $vehicle?->id,
                $rideInterval['start'],
                $rideInterval['end'],
                [
                    'exclude_ride_booking_id' => $locked->id,
                    'exact_interval' => true,
                ]
            );
            if (! empty($conflicts)) {
                return;
            }

            $locked->update([
                'driver_id' => $user->id,
                'vehicle_id' => $vehicle->id,
                'status' => 'driver_assigned',
                'driver_assigned_at' => now(),
                'dispatch_status' => 'assigned',
                'admin_assignable' => false,
                'start_ride_pin' => $locked->start_ride_pin ?: RideBooking::generateStartRidePin(),
                'start_pin_verified_at' => null,
            ]);

            DriverAvailability::where('driver_id', $user->id)->update([
                'is_available' => false,
                'status' => 'on_ride',
                'last_updated' => now(),
            ]);

            try {
                broadcast(new RideStatusUpdated($locked, 'driver_assigned', 'Driver assigned', 'pending'));
                broadcast(new RideAssigned($locked, $user->id));
            } catch (\Throwable $e) {
                \Log::warning('Failed to broadcast ride assignment: '.$e->getMessage());
            }

            app(DriverDispatchService::class)->markAccepted($locked, $user);

            $accepted = true;
        });

        if (! $accepted) {
            return response()->json([
                'success' => false,
                'message' => 'Ride already assigned to another driver.',
            ], 409);
        }

        $booking->refresh()->load('customer:id,name,phone');
        app(BookingLifecycleNotifier::class)->emit($booking, 'driver.assigned', ['driver_id' => $user->id]);
        app(BookingLifecycleNotifier::class)->emit($booking, 'booking.accepted', ['driver_id' => $user->id]);

        return response()->json([
            'success' => true,
            'message' => 'Ride accepted successfully.',
            'ride' => $this->mapRide($booking),
        ]);
    }

    public function cancelRide(Request $request, RideBooking $booking)
    {
        abort_unless($request->user() instanceof \App\Models\Driver && (int) $booking->driver_id === (int) $request->user()->id, 403);
        $validated = $request->validate(['reason' => 'required|string|max:1000']);
        app(\App\Services\BookingCancellationService::class)->cancel($booking, 'ride', $validated['reason'], null, 'driver', (int) $request->user()->id);

        return response()->json(['success' => true, 'ride' => $this->mapRide($booking->fresh())]);
    }

    public function reportRideIssue(Request $request, RideBooking $booking)
    {
        abort_unless($request->user() instanceof \App\Models\Driver && (int) $booking->driver_id === (int) $request->user()->id, 403);
        $data = $request->validate(['description' => 'required|string|max:2000']);
        $incident = $booking->incidents()->create([
            'customer_id' => $booking->customer_id, 'driver_id' => $booking->driver_id,
            'opened_by_type' => \App\Models\Driver::class, 'opened_by_id' => $request->user()->id,
            'type' => 'other', 'severity' => 'high', 'status' => 'open',
            'title' => 'Driver reported a ride issue', 'description' => $data['description'], 'reported_at' => now(),
        ]);

        return response()->json(['success' => true, 'data' => $incident], 201);
    }

    public function declineRide(Request $request, RideBooking $booking)
    {
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $validated = $request->validate([
            'reason' => 'nullable|string|max:1000',
        ]);

        abort_if($booking->driver_id, 409, 'Use cancellation for an accepted ride.');

        if ($booking->driver_id && (int) $booking->driver_id !== (int) $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot decline a ride assigned to another driver.',
            ], 403);
        }

        $attempt = app(DriverDispatchService::class)->markDeclined(
            $booking,
            $user,
            $validated['reason'] ?? null
        );
        app(BookingLifecycleNotifier::class)->emit($booking->fresh('customer'), 'booking.declined', [
            'driver_id' => $user->id,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Ride declined.',
            'attempt' => $attempt,
        ]);
    }

    public function updatePaymentStatus(Request $request, RideBooking $booking)
    {
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        if ((int) $booking->driver_id !== (int) $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'You can only update payment for your assigned rides.',
            ], 403);
        }

        $validated = $request->validate([
            'payment_status' => 'required|in:paid',
            'payment_method' => 'required|in:cash',
            'collection_reference' => 'required|string|max:255',
        ]);
        app(\App\Services\PaymentService::class)->recordCashCollection($booking, (int) $user->id, $validated['collection_reference']);
        app(BookingLifecycleNotifier::class)->emit($booking->fresh('customer'), 'payment.paid', ['driver_id' => $user->id]);

        return response()->json([
            'success' => true,
            'message' => 'Payment status updated.',
            'ride' => $this->mapRide($booking->fresh(['customer:id,name,phone'])),
        ]);
    }

    public function updateRideNote(Request $request, RideBooking $booking)
    {
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        if ((int) $booking->driver_id !== (int) $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'You can only update notes for your assigned rides.',
            ], 403);
        }

        $validated = $request->validate([
            'driver_notes' => 'nullable|string|max:2000',
        ]);

        $booking->update([
            'driver_notes' => $validated['driver_notes'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Ride note updated.',
            'ride' => $this->mapRide($booking->fresh(['customer:id,name,phone'])),
        ]);
    }

    public function fundingStatus(Request $request)
    {
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $balanceMinor = $user->getWalletBalanceMinor();
        $minTopUp = (int) setting('driver.minimum_topup_minor', 50000);
        $dispatchMin = (int) setting('driver.dispatch_eligible_balance_minor', 10000);
        $warningThreshold = (int) setting('driver.warning_balance_minor', 50000);

        return response()->json([
            'success' => true,
            'data' => [
                'funding_eligible' => $user->isFundingEligible(),
                'balance_minor' => $balanceMinor,
                'balance' => round($balanceMinor / 100, 2),
                'minimum_topup_minor' => $minTopUp,
                'dispatch_eligible_balance_minor' => $dispatchMin,
                'warning_balance_minor' => $warningThreshold,
                'needs_topup_warning' => $balanceMinor < $warningThreshold,
                'is_dispatch_eligible' => $balanceMinor >= $dispatchMin,
            ],
        ]);
    }

    public function topUp(Request $request)
    {
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $minTopUp = (int) setting('driver.minimum_topup_minor', 50000);
        $validated = $request->validate([
            'amount_minor' => 'required|integer|min:'.$minTopUp,
        ], [
            'amount_minor.min' => 'The minimum top-up amount is ₹'.($minTopUp / 100).'.',
        ]);

        try {
            $data = app(\App\Services\DriverFundingService::class)->createTopUpOrder($user, $validated['amount_minor']);

            return response()->json(['success' => true, 'data' => $data]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function verifyTopUp(Request $request)
    {
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $orderId = $request->input('razorpay_order_id') ?? $request->input('order_id');
        $paymentId = $request->input('razorpay_payment_id') ?? $request->input('payment_id');
        $signature = $request->input('razorpay_signature') ?? $request->input('signature') ?? 'sig_demo_'.time();
        $idempotencyKey = $request->input('idempotency_key')
            ?: ($orderId && $paymentId ? "driver_topup:{$orderId}:{$paymentId}" : null);

        if (! $orderId || ! $paymentId) {
            return response()->json([
                'success' => false,
                'message' => 'Missing order ID or payment ID.',
            ], 422);
        }

        try {
            $transaction = app(\App\Services\DriverFundingService::class)->verifyTopUp(
                $user,
                $orderId,
                $paymentId,
                $signature,
                $idempotencyKey
            );

            return response()->json([
                'success' => true,
                'message' => 'Top-up successful',
                'data' => [
                    'transaction_id' => $transaction->id,
                    'balance_minor' => $user->fresh()->getWalletBalanceMinor(),
                    'funding_eligible' => $user->fresh()->isFundingEligible(),
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Driver top-up verification failed', [
                'driver_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    private function mapRide(RideBooking $ride): array
    {
        return [
            'sharing_requested' => (bool) $ride->sharing_requested,
            'shared_trip' => app(\App\Services\SharedTripService::class)->driverView($ride),
            'id' => $ride->id,
            'booking_number' => $ride->booking_number,
            'status' => $ride->status,
            'pickup_location' => $ride->pickup_location,
            'pickup_lat' => $ride->pickup_lat ? (float) $ride->pickup_lat : null,
            'pickup_lng' => $ride->pickup_lng ? (float) $ride->pickup_lng : null,
            'dropoff_location' => $ride->dropoff_location,
            'dropoff_lat' => $ride->dropoff_lat ? (float) $ride->dropoff_lat : null,
            'dropoff_lng' => $ride->dropoff_lng ? (float) $ride->dropoff_lng : null,
            'scheduled_at' => $ride->scheduled_at,
            'total_fare' => (float) $ride->total_fare,
            'distance_km' => $ride->estimated_distance_km ? (float) $ride->estimated_distance_km : 0.0,
            'estimated_distance_km' => $ride->estimated_distance_km ? (float) $ride->estimated_distance_km : 0.0,
            'service_type' => $ride->service_type,
            'payment_status' => $ride->payment_status,
            'payment_method' => $ride->payment_method,
            'commission_amount' => $ride->commission_amount !== null ? (float) $ride->commission_amount : app(\App\Services\CommissionService::class)->calculateRideCommission($ride),
            'driver_share' => $ride->driver_share !== null ? (float) $ride->driver_share : max(0, round((float) $ride->total_fare - app(\App\Services\CommissionService::class)->calculateRideCommission($ride), 2)),
            'driver_notes' => $ride->driver_notes,
            'vehicle_number' => $ride->driver?->vehicle_number,
            'customer_name' => $ride->customer_name ?: ($ride->customer?->name ?? 'Customer'),
            'customer_phone' => $ride->customer_phone ?: ($ride->customer?->phone ?? ''),
        ];
    }
}

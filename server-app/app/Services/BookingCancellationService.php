<?php

namespace App\Services;

use App\Models\BookingRefund;
use App\Models\CarRental;
use App\Models\RideBooking;
use App\Models\TourBooking;
use App\Models\Wallet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class BookingCancellationService
{
    public function cancel(
        Model $booking,
        string $serviceType,
        ?string $reason = null,
        ?int $processedBy = null,
        string $actor = 'customer',
        ?int $actorId = null
    ): ?BookingRefund {
        return DB::transaction(function () use ($booking, $serviceType, $reason, $processedBy, $actor, $actorId) {
            if ($booking instanceof RideBooking && $booking->driver_id) {
                \App\Models\Driver::whereKey($booking->driver_id)->lockForUpdate()->firstOrFail();
            }
            $booking = $booking->newQuery()->lockForUpdate()->findOrFail($booking->getKey());

            if ($actor === 'driver') {
                abort_unless($actorId !== null && (int) $booking->driver_id === $actorId, 403, 'The ride is no longer assigned to you.');
            }

            if ($booking->status === 'cancelled') {
                return $booking->refunds()->latest()->first();
            }

            abort_if($booking->status === 'completed', 422, 'Completed bookings cannot be cancelled.');
            if ($actor === 'driver') {
                abort_unless(app(BookingStatusService::class)->canTransition($serviceType, $booking->status, 'cancelled', 'driver'), 422, 'This ride can no longer be cancelled by the driver.');
            }
            $previousStatus = $booking->status;
            $totalAmount = $this->bookingTotal($booking);
            $isPaid = $booking->payment_status === 'paid' || ($booking instanceof TourBooking && $booking->payment_plan && $booking->online_paid_minor > 0);
            $received = $booking instanceof TourBooking && $booking->payment_plan ? \App\Support\Money::toMajor($booking->online_paid_minor) : $totalAmount;
            $wasConfirmed = $booking instanceof TourBooking
                && in_array($booking->status, ['confirmed', 'in_progress'], true);
            $cancellationFee = $isPaid && $actor === 'customer' ? $this->calculateFee($booking, $serviceType) : 0.0;
            $cancellationFee = min($cancellationFee, $received);
            $refundAmount = $isPaid ? max(0, $received - $cancellationFee) : 0.0;

            $booking->forceFill(array_filter([
                'status' => 'cancelled',
                'cancellation_reason' => $reason ?: $booking->cancellation_reason,
                'cancelled_at' => now(),
                'cancellation_fee' => $cancellationFee,
                'refund_amount' => $refundAmount,
                'cancelled_by_type' => $booking instanceof CarRental ? $actor : null,
            ], fn ($v) => $v !== null))->save();

            $booking->auditLogs()->create([
                'action' => 'booking.cancelled',
                'before' => ['status' => $previousStatus],
                'after' => ['status' => 'cancelled', 'actor' => $actor, 'driver_id' => $booking->driver_id, 'cancellation_fee' => $cancellationFee],
                'note' => $reason,
            ]);
            if ($booking instanceof RideBooking) {
                $booking->dispatchAttempts()->where('status', 'offered')->update(['status' => 'expired']);
                $booking->update(['admin_assignable' => false]);
                $this->releaseRideDriver($booking);
                DB::afterCommit(function () use ($booking, $previousStatus) {
                    try {
                        broadcast(new \App\Events\RideStatusUpdated($booking, 'cancelled', $booking->cancellation_reason, $previousStatus));
                    } catch (\Throwable $exception) {
                        \Illuminate\Support\Facades\Log::warning('Cancellation broadcast failed; durable lifecycle notification remains queued.', ['booking_id' => $booking->id, 'exception' => $exception::class]);
                    }
                });
            }
            app(BookingLifecycleNotifier::class)->emit($booking, 'booking.cancelled', ['actor' => $actor, 'previous_status' => $previousStatus]);

            if ($booking instanceof TourBooking) {
                $this->releaseTourSeats($booking, $wasConfirmed);
            }

            if ($booking instanceof CarRental) {
                $this->releaseRentalDriver($booking);
                if ($booking->driver_id) {
                    $driver = \App\Models\Driver::find($booking->driver_id);
                    if ($driver) {
                        app(BookingLifecycleNotifier::class)->emit($driver, 'rental.driver_released', [
                            'rental_id' => $booking->id,
                            'booking_number' => $booking->booking_number,
                            'reason' => $reason,
                            'actor' => $actor,
                        ]);
                    }
                }
            }

            if (! $isPaid || $refundAmount <= 0) {
                return null;
            }

            $refund = $booking->refunds()->create([
                'customer_id' => $booking->customer_id,
                'amount' => $refundAmount,
                'cancellation_fee' => $cancellationFee,
                'method' => $booking instanceof TourBooking && $booking->payment_plan ? 'online' : ($booking->payment_method ?: 'manual'),
                'status' => $booking->payment_method === 'wallet' ? 'processed' : 'pending',
                'reason' => $reason,
                'processed_at' => $booking->payment_method === 'wallet' ? now() : null,
                'processed_by' => $booking->payment_method === 'wallet' ? $processedBy : null,
            ]);

            if ($booking->payment_method === 'wallet') {
                if ($booking instanceof TourBooking && $booking->settled_at) {
                    app(TourSettlementService::class)->reverse($booking);
                }
                $transaction = $this->refundToWallet($booking, $refundAmount, $serviceType, 'booking-refund:'.$refund->id);
                $refund->update(['wallet_transaction_id' => $transaction->id]);
                $booking->forceFill([
                    'payment_status' => 'refunded',
                    'refunded_at' => now(),
                ])->save();
            }

            return $refund->fresh();
        });
    }

    public function releaseRideDriver(RideBooking $booking): void
    {
        $driver = $booking->driver_id ? \App\Models\Driver::find($booking->driver_id) : null;
        if (! $driver || app(DriverDispatchService::class)->hasActiveWorkload($driver)) {
            return;
        }
        \App\Models\DriverAvailability::where('driver_id', $booking->driver_id)->where('status', 'on_ride')
            ->update(['is_available' => true, 'status' => 'online']);
    }

    public function releaseRentalDriver(CarRental $rental): void
    {
        $driver = $rental->driver_id ? \App\Models\Driver::find($rental->driver_id) : null;
        if (! $driver || app(DriverDispatchService::class)->hasActiveWorkload($driver)) {
            return;
        }
        \App\Models\DriverAvailability::where('driver_id', $rental->driver_id)->where('status', 'on_ride')
            ->update(['is_available' => true, 'status' => 'online']);
    }

    public function processRefund(BookingRefund $refund, ?int $processedBy = null): BookingRefund
    {
        return DB::transaction(function () use ($refund, $processedBy) {
            $booking = $refund->refundable;
            if ($booking) {
                $booking = $booking->newQuery()->lockForUpdate()->find($booking->getKey());
            }
            $refund = BookingRefund::lockForUpdate()->findOrFail($refund->id);

            if ($refund->status === 'processed') {
                return $refund;
            }

            if (! $booking) {
                $refund->update(['status' => 'failed']);

                return $refund->fresh();
            }

            if ($booking instanceof TourBooking && $booking->settled_at) {
                app(TourSettlementService::class)->reverse($booking);
            }
            $transaction = $this->refundToWallet($booking, (float) $refund->amount, $this->serviceTypeFor($booking), 'booking-refund:'.$refund->id);

            $refund->update([
                'wallet_transaction_id' => $transaction->id,
                'method' => 'wallet',
                'status' => 'processed',
                'processed_at' => now(),
                'processed_by' => $processedBy,
            ]);

            $paymentStatus = 'refunded';
            if ($booking instanceof TourBooking && $booking->payment_plan) {
                $paymentStatus = $booking->status === 'cancelled'
                    ? ($booking->refunds()->where('status', 'pending')->exists() ? 'partial' : 'refunded')
                    : ((int) $booking->online_paid_minor + app(TourSettlementService::class)->cashCollectedMinor($booking) >= $booking->payment_plan['total_minor'] ? 'paid'
                        : ($booking->online_paid_minor > 0 ? 'partial' : 'pending'));
            }
            if ($booking instanceof CarRental && $booking->status !== 'cancelled' && $refund->reason === 'Rental reduced') {
                $net = (int) $booking->payments()->whereNotNull('captured_at')->sum('amount_minor') - \App\Support\Money::toMinor($booking->refunds()->where('status', 'processed')->sum('amount'));
                $paymentStatus = $net >= \App\Support\Money::toMinor($booking->total_price) ? 'paid' : 'pending';
            }
            $booking->forceFill([
                'payment_status' => $paymentStatus,
                'refunded_at' => $paymentStatus === 'refunded' ? now() : null,
            ])->save();

            return $refund->fresh();
        });
    }

    /**
     * Preview the cancellation fee and refund without persisting — used by the cancel-preview endpoint.
     *
     * @return array{cancellation_fee: float, refund_amount: float, total: float, tier: string, hours_to_start: float|null}
     */
    public function cancelPreview(Model $booking, string $serviceType, string $actor = 'customer'): array
    {
        $totalAmount = $this->bookingTotal($booking);
        $isPaid = $booking->payment_status === 'paid' || ($booking instanceof TourBooking && $booking->payment_plan && $booking->online_paid_minor > 0);
        $received = $booking instanceof TourBooking && $booking->payment_plan ? \App\Support\Money::toMajor($booking->online_paid_minor) : $totalAmount;
        $fee = $isPaid && $actor === 'customer' ? $this->calculateFee($booking, $serviceType) : 0.0;
        $fee = min($fee, $received);
        $refundAmount = $isPaid ? max(0, $received - $fee) : 0.0;

        $startAt = $this->bookingStartAt($booking);
        $hoursToStart = $startAt ? max(0, round(now()->floatDiffInHours($startAt, false), 2)) : null;
        $tier = $this->feeLabel($booking, $serviceType);

        return [
            'cancellation_fee' => $fee,
            'refund_amount' => $refundAmount,
            'total' => $totalAmount,
            'tier' => $tier,
            'hours_to_start' => $hoursToStart,
        ];
    }

    public function calculateFee(Model $booking, string $serviceType): float
    {
        $totalAmount = $this->bookingTotal($booking);
        if ($totalAmount <= 0) {
            return 0.0;
        }

        if ($this->isAlreadyActive($booking, $serviceType)) {
            return round($totalAmount * (float) setting('cancellation.active_fee_percent', 0.20), 2);
        }

        // ── Rental-specific multi-tier policy ───────────────────────
        if ($booking instanceof CarRental) {
            return $this->rentalCancellationFee($booking, $totalAmount);
        }

        // ── Generic 2-tier for other services ───────────────────────
        $startAt = $this->bookingStartAt($booking);
        if ($startAt && now()->diffInHours($startAt, false) < (int) setting('cancellation.late_window_hours', 24)) {
            return round($totalAmount * (float) setting('cancellation.late_fee_percent', 0.10), 2);
        }

        return 0.0;
    }

    /**
     * Rental-specific 3-tier fee: free → medium → late.
     *
     * Default tiers:
     *   >48 h before start ⇒ 0 % (free)
     *   24-48 h            ⇒ 25 %
     *   <24 h              ⇒ 50 %
     */
    private function rentalCancellationFee(CarRental $rental, float $total): float
    {
        $startAt = $this->bookingStartAt($rental);
        if (! $startAt) {
            return 0.0;
        }

        $hoursToStart = max(0, now()->floatDiffInHours($startAt, false));

        $freeThreshold = (float) setting('cancellation.rental_free_hours', 48);
        $mediumThreshold = (float) setting('cancellation.rental_medium_hours', 24);
        $mediumPercent = (float) setting('cancellation.rental_medium_fee_percent', 0.25);
        $latePercent = (float) setting('cancellation.rental_late_fee_percent', 0.50);

        if ($hoursToStart >= $freeThreshold) {
            return 0.0;
        }

        if ($hoursToStart >= $mediumThreshold) {
            return round($total * $mediumPercent, 2);
        }

        return round($total * $latePercent, 2);
    }

    /**
     * Human-readable label for the fee tier.
     */
    private function feeLabel(Model $booking, string $serviceType): string
    {
        if ($this->isAlreadyActive($booking, $serviceType)) {
            return 'active';
        }

        if ($booking instanceof CarRental) {
            $startAt = $this->bookingStartAt($booking);
            if (! $startAt) {
                return 'free';
            }
            $hours = max(0, now()->floatDiffInHours($startAt, false));
            $freeH = (float) setting('cancellation.rental_free_hours', 48);
            $medH = (float) setting('cancellation.rental_medium_hours', 24);
            if ($hours >= $freeH) {
                return 'free';
            }

            return $hours >= $medH ? 'medium' : 'late';
        }

        $startAt = $this->bookingStartAt($booking);
        if ($startAt && now()->diffInHours($startAt, false) < (int) setting('cancellation.late_window_hours', 24)) {
            return 'late';
        }

        return 'free';
    }

    private function refundToWallet(Model $booking, float $amount, string $serviceType, string $idempotencyKey)
    {
        $wallet = Wallet::query()->firstOrCreate([
            'owner_type' => get_class($booking->customer),
            'owner_id' => $booking->customer_id,
        ], [
            'balance' => 0,
            'currency' => 'INR',
            'is_active' => true,
        ]);

        return $wallet->credit(
            $amount,
            ucfirst($serviceType).' booking refund',
            $this->serviceTypeFor($booking).'_refund',
            (string) $booking->id,
            $idempotencyKey
        );
    }

    private function bookingTotal(Model $booking): float
    {
        return match (true) {
            $booking instanceof RideBooking => (float) $booking->total_fare,
            $booking instanceof TourBooking => (float) $booking->total_price,
            $booking instanceof CarRental => (float) $booking->total_price,
            default => 0.0,
        };
    }

    private function releaseTourSeats(TourBooking $booking, bool $wasConfirmed): void
    {
        $schedule = $booking->schedule()->lockForUpdate()->first();
        if (! $schedule) {
            return;
        }

        $seats = $booking->getTotalPax();
        $column = $wasConfirmed ? 'booked_seats' : 'reserved_seats';
        $schedule->decrement($column, min((int) $schedule->{$column}, $seats));

        DB::afterCommit(function () use ($schedule) {
            try {
                app(\App\Services\TourWaitlistService::class)->notifyCapacityAvailable($schedule);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Waitlist notification failed upon tour seat release: '.$e->getMessage());
            }
        });
    }

    private function bookingStartAt(Model $booking): mixed
    {
        return match (true) {
            $booking instanceof RideBooking => $booking->scheduled_at,
            $booking instanceof TourBooking => $booking->schedule?->departure_at,
            $booking instanceof CarRental => $booking->start_date?->startOfDay(),
            default => null,
        };
    }

    private function isAlreadyActive(Model $booking, string $serviceType): bool
    {
        return match ($serviceType) {
            BookingStatusService::RIDE => in_array($booking->status, ['driver_arriving', 'pickup', 'in_transit'], true),
            BookingStatusService::TOUR => $booking->status === 'in_progress',
            BookingStatusService::RENTAL => $booking->status === 'in_progress',
            default => false,
        };
    }

    private function serviceTypeFor(Model $booking): string
    {
        return match (true) {
            $booking instanceof RideBooking => BookingStatusService::RIDE,
            $booking instanceof TourBooking => BookingStatusService::TOUR,
            $booking instanceof CarRental => BookingStatusService::RENTAL,
            default => 'booking',
        };
    }
}

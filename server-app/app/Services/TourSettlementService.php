<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\Payment;
use App\Models\TourBooking;
use App\Models\Wallet;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class TourSettlementService
{
    public function __construct(
        private LedgerService $ledger,
        private WalletLedgerService $walletLedger,
        private PaymentService $payments,
    ) {}

    /**
     * Settle a completed tour booking: account for online deposits, platform margin,
     * cash collected by driver, and net driver wallet adjustment.
     */
    public function settle(TourBooking $booking): bool
    {
        return DB::transaction(function () use ($booking) {
            $booking = TourBooking::lockForUpdate()->findOrFail($booking->id);

            // Idempotency: check if already settled
            if ($booking->settled_at) {
                return true;
            }

            if ($booking->status !== 'completed' || ! $booking->payment_plan
                || $booking->refunds()->whereIn('status', ['pending', 'processed'])->exists()) {
                return false;
            }
            $policy = $booking->payment_plan['margin_policy'] ?? null;
            if (! is_array($policy) || ! isset($policy['basis_points'], $policy['version'])
                || ! is_int($policy['basis_points']) || $policy['basis_points'] < 0 || $policy['basis_points'] > 10000) {
                return false;
            }
            $totalMinor = $this->bookingTotalMinor($booking);
            $marginRate = $policy['basis_points'] / 10000;
            $marginMinor = intdiv($totalMinor * $policy['basis_points'] + 5000, 10000);
            $driverEntitlementMinor = $totalMinor - $marginMinor;
            $onlinePaidMinor = (int) $booking->online_paid_minor;
            $cashCollectedMinor = $this->cashCollectedMinor($booking);
            $verifiedOnline = (int) $booking->payments()->where('provider', 'razorpay')->whereNotNull('captured_at')->sum('amount_minor');
            if ($onlinePaidMinor <= 0 || $verifiedOnline !== $onlinePaidMinor
                || $onlinePaidMinor + $cashCollectedMinor !== $totalMinor) {
                return false;
            }
            $netSettlementMinor = $driverEntitlementMinor - $cashCollectedMinor;
            // Negative settlements require an approved recovery policy; never invent debt.
            if ($netSettlementMinor < 0) {
                return false;
            }

            $driverId = $booking->assigned_driver_id ?: $booking->driverAssignments()->whereIn('status', ['accepted', 'completed'])->whereIn('role', ['transport', 'both'])->value('driver_id');
            if ($booking->payments()->where('provider', 'cash')->where('notes->driver_id', '!=', $driverId)->exists()) {
                return false;
            }
            if (! $driverId) {
                return false;
            }

            $driver = Driver::find($driverId);
            if (! $driver) {
                return false;
            }

            $wallet = Wallet::firstOrCreate([
                'owner_type' => Driver::class,
                'owner_id' => $driver->id,
            ], [
                'balance' => 0,
                'balance_minor' => 0,
                'currency' => 'INR',
                'is_active' => true,
            ]);

            $idempotencyKey = "tour_settlement:{$booking->id}";

            if ($netSettlementMinor > 0) {
                $this->walletLedger->credit(
                    $wallet,
                    Money::toMajor($netSettlementMinor),
                    'Tour settlement credit',
                    'driver_earning',
                    "tour_booking:{$booking->id}",
                    $idempotencyKey
                );
            } elseif ($netSettlementMinor < 0) {
                $this->walletLedger->debit(
                    $wallet,
                    Money::toMajor(abs($netSettlementMinor)),
                    'Tour settlement debit',
                    'driver_earning',
                    "tour_booking:{$booking->id}",
                    $idempotencyKey
                );
            }

            $breakdown = [
                'driver_id' => $driverId,
                'total_minor' => $totalMinor,
                'margin_rate' => $marginRate,
                'margin_minor' => $marginMinor,
                'driver_entitlement_minor' => $driverEntitlementMinor,
                'online_paid_minor' => $onlinePaidMinor,
                'cash_collected_minor' => $cashCollectedMinor,
                'net_settlement_minor' => $netSettlementMinor,
            ];

            $booking->update([
                'margin_minor' => $marginMinor,
                'driver_entitlement_minor' => $driverEntitlementMinor,
                'cash_collected_minor' => $cashCollectedMinor,
                'net_settlement_minor' => $netSettlementMinor,
                'settled_at' => now(),
                'settlement_breakdown' => $breakdown,
                'commission_amount' => Money::toMajor($marginMinor),
                'driver_share' => Money::toMajor($driverEntitlementMinor),
            ]);

            $booking->auditLogs()->create([
                'action' => 'tour.settled',
                'note' => 'Tour settled with net driver adjustment of '.Money::toMajor($netSettlementMinor),
                'after' => $breakdown,
            ]);

            return true;
        });
    }

    /**
     * Get the remaining cash the driver needs to collect for a booking.
     */
    public function reverse(TourBooking $booking): void
    {
        if (! $booking->settled_at || isset($booking->settlement_breakdown['reversed_at'])) {
            return;
        }
        $net = (int) $booking->net_settlement_minor;
        if ($net > 0) {
            $driverId = $booking->settlement_breakdown['driver_id'] ?? $booking->assigned_driver_id;
            $wallet = Wallet::where('owner_type', Driver::class)->where('owner_id', $driverId)->firstOrFail();
            $wallet->debit(Money::toMajor($net), 'Reverse tour settlement before refund', 'driver_earning',
                'tour_booking:'.$booking->id, 'tour_settlement_reversal:'.$booking->id);
        }
        $booking->update(['settlement_breakdown' => [...$booking->settlement_breakdown, 'reversed_at' => now()->toIso8601String()]]);
        $booking->auditLogs()->create(['action' => 'tour.settlement_reversed', 'after' => ['net_minor' => $net]]);
    }

    public function remainingCashMinor(TourBooking $booking): int
    {
        $totalMinor = $this->bookingTotalMinor($booking);
        $onlinePaid = (int) $booking->online_paid_minor;
        $cashCollected = $this->cashCollectedMinor($booking);

        return max(0, $totalMinor - $onlinePaid - $cashCollected);
    }

    public function cashCollectedMinor(TourBooking $booking): int
    {
        return (int) Payment::where('payable_type', TourBooking::class)
            ->where('payable_id', $booking->id)
            ->where('provider', 'cash')
            ->where('status', Payment::STATUS_CAPTURED)->whereNotNull('captured_at')
            ->sum('amount_minor');
    }

    private function bookingTotalMinor(TourBooking $booking): int
    {
        if ($booking->payment_plan) {
            return (int) $booking->payment_plan['total_minor'];
        }

        return (int) round((float) $booking->total_price * 100);
    }
}

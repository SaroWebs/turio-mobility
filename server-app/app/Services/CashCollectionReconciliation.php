<?php

namespace App\Services;

use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\RideBooking;
use App\Models\WalletTransaction;
use App\Support\Money;

/** Read-only reconciliation of driver-declared ride cash. Never invents receipts. */
class CashCollectionReconciliation
{
    public function run(): array
    {
        $report = ['checked' => 0, 'collected_minor' => 0, 'drivers' => [], 'issues' => []];
        $issue = function (string $code, ?int $bookingId, ?int $paymentId = null) use (&$report) {
            $report['issues'][] = ['code' => $code, 'booking_id' => $bookingId, 'payment_id' => $paymentId];
        };

        $checkModel = function ($modelClass, $payments) use (&$report, $issue) {
            foreach ($payments as $payment) {
                $report['checked']++;
                $booking = $payment->payable;
                $driverId = (int) ($payment->notes['driver_id'] ?? 0);
                $report['collected_minor'] += $payment->amount_minor;
                $report['drivers'][$driverId] = ($report['drivers'][$driverId] ?? 0) + $payment->amount_minor;
                if (! $booking) {
                    $issue('missing_booking', null, $payment->id);
                    continue;
                }
                
                $isTour = $booking instanceof \App\Models\TourBooking;
                if ($isTour) {
                    $assignment = $booking->driverAssignments()->where('driver_id', $driverId)->whereIn('status', ['accepted', 'completed'])->first();
                    $isAssigned = $assignment !== null || (int)$booking->assigned_driver_id === $driverId;
                } else {
                    $isAssigned = $driverId === (int) $booking->driver_id;
                }

                if (! $isAssigned || ! $driverId || empty($payment->notes['evidence'])) {
                    $issue('collection_evidence_mismatch', $booking->id, $payment->id);
                }

                if ($payment->currency !== 'INR') {
                    $issue('amount_mismatch', $booking->id, $payment->id);
                }
                
                if (!$isTour && $payment->amount_minor !== Money::toMinor($booking->total_fare)) {
                    $issue('amount_mismatch', $booking->id, $payment->id);
                }

                if (!$isTour && ($booking->status !== 'completed' || !in_array($booking->payment_status, ['paid', 'refunded'], true))) {
                    $issue('booking_state_mismatch', $booking->id, $payment->id);
                } elseif ($isTour && !in_array($booking->status, ['in_progress', 'completed'])) {
                    $issue('booking_state_mismatch', $booking->id, $payment->id);
                }
                
                $ref = $payment->notes['ledger_transaction_ref'] ?? null;
                if (! $ref) {
                    $issue('missing_ledger_link', $booking->id, $payment->id);
                } else {
                    $entries = LedgerEntry::with('account')->where('transaction_ref', $ref)->get();
                    $debit = $entries->where('direction', 'debit')->first();
                    $credit = $entries->where('direction', 'credit')->first();
                    if ($entries->count() !== 2 || ! $debit || ! $credit
                        || $debit->amount_minor !== $payment->amount_minor || $credit->amount_minor !== $payment->amount_minor
                        || $debit->account?->code !== 'driver:'.$driverId.':cash_collected' || $credit->account?->code !== 'system:booking_revenue'
                        || $entries->contains(fn ($entry) => $entry->currency !== 'INR' || $entry->reference_type !== get_class($booking) || (int) $entry->reference_id !== $booking->id)) {
                        $issue('ledger_mismatch', $booking->id, $payment->id);
                    }
                }
                
                if (WalletTransaction::where('reference_type', 'driver_earning')->where('reference_id', ($isTour ? 'tour_booking:' : 'ride_booking:').$booking->id)->where('type', 'credit')->exists()) {
                    if (!$isTour) {
                        $issue('cash_also_credited_to_wallet', $booking->id, $payment->id);
                    }
                }
                
                if (! $booking->auditLogs()->where('action', 'cash.collected')->get()->contains(fn ($audit) => (int) ($audit->after['payment_id'] ?? 0) === $payment->id)) {
                    $issue('missing_collection_audit', $booking->id, $payment->id);
                }
            }
        };

        Payment::where('provider', 'cash')->where('payable_type', RideBooking::class)->whereNotNull('captured_at')
            ->with('payable')->chunkById(100, function ($payments) use ($checkModel) {
                $checkModel(RideBooking::class, $payments);
            });

        Payment::where('provider', 'cash')->where('payable_type', \App\Models\TourBooking::class)->whereNotNull('captured_at')
            ->with('payable')->chunkById(100, function ($payments) use ($checkModel) {
                $checkModel(\App\Models\TourBooking::class, $payments);
            });

        RideBooking::where('payment_method', 'cash')->where('payment_status', 'paid')
            ->whereDoesntHave('payments', fn ($query) => $query->whereNotNull('captured_at'))
            ->chunkById(100, function ($rides) use ($issue) {
                foreach ($rides as $ride) {
                    $issue('paid_without_receipt', $ride->id);
                }
            });

        return $report;
    }
}

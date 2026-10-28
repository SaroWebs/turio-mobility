<?php

namespace App\Services;

use App\Models\CarRental;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\ReconciliationMismatch;
use App\Models\RideBooking;
use App\Models\TourBooking;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Throwable;

/**
 * Nightly reconciliation sweep (SKY-MRD-001 §8.7, §13.1, §13.3).
 *
 * Cross-checks three sources of truth that must agree:
 *   1. the double-entry ledger is internally balanced (every transaction and the
 *      book as a whole net to zero);
 *   2. every captured payment and processed payout left the ledger entries it
 *      should have (nothing settled money without a posting, no amount drift);
 *   3. the provider's own settlement figures do not exceed what we recorded.
 *
 * Discrepancies are written to `reconciliation_mismatches` for a human to
 * resolve — the sweep never "fixes" money by itself. Rows are keyed by
 * (type, reference_type, reference_id) while open, so a re-run updates the
 * existing row instead of duplicating it, and a reference that has since become
 * consistent is auto-resolved. All amounts are integer minor units (paise).
 */
class ReconciliationService
{
    /** Payment statuses that imply the capture posting should exist. */
    private const CAPTURED_STATUSES = [
        Payment::STATUS_CAPTURED,
        Payment::STATUS_PARTIALLY_REFUNDED,
        Payment::STATUS_REFUNDED,
    ];

    public function __construct(private RazorpayService $razorpay) {}

    /**
     * Run the sweep over [$from, $to] (defaults to the previous 24h ending now).
     * $checkProvider fetches Razorpay settlements; skipped silently when the
     * provider is not configured so local/test runs never touch the network.
     *
     * @return array<string,mixed> summary report
     */
    public function run(?Carbon $from = null, ?Carbon $to = null, bool $checkProvider = true): array
    {
        $to ??= now();
        $from ??= $to->copy()->subDay();
        $runId = (string) Str::uuid();

        /** @var array<string,array<string,mixed>> $found keyed to dedupe within a run */
        $found = [];
        $evaluatedTypes = [];

        $this->checkLedgerBalance($from, $to, $found, $evaluatedTypes);
        $this->checkPayments($from, $to, $found, $evaluatedTypes);
        $this->checkPayouts($from, $to, $found, $evaluatedTypes);

        $providerStatus = 'skipped';
        if ($checkProvider && $this->providerConfigured()) {
            $providerStatus = $this->checkProviderSettlements($from, $to, $found, $evaluatedTypes);
        }

        [$opened, $updated] = $this->persist($runId, $found);
        $resolved = $this->autoResolve($runId, $found, $evaluatedTypes);

        return [
            'run_id' => $runId,
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'provider' => $providerStatus,
            'mismatches' => count($found),
            'opened' => $opened,
            'updated' => $updated,
            'resolved' => $resolved,
            'by_type' => $this->countByType($found),
        ];
    }

    // ── Checks ─────────────────────────────────────────────────────────

    /**
     * (1) The book must balance: total debits == total credits overall, and each
     * transaction_ref posted in the window must net to zero on its own.
     */
    private function checkLedgerBalance(Carbon $from, Carbon $to, array &$found, array &$evaluatedTypes): void
    {
        $evaluatedTypes[ReconciliationMismatch::TYPE_LEDGER_IMBALANCE] = true;

        $debits = (int) LedgerEntry::where('direction', 'debit')->sum('amount_minor');
        $credits = (int) LedgerEntry::where('direction', 'credit')->sum('amount_minor');

        if ($debits !== $credits) {
            $this->record($found, [
                'type' => ReconciliationMismatch::TYPE_LEDGER_IMBALANCE,
                'reference_type' => 'ledger',
                'reference_id' => 'global',
                'expected_minor' => $credits,
                'actual_minor' => $debits,
                'details' => [
                    'message' => 'Total ledger debits do not equal total credits.',
                    'debit_minor' => $debits,
                    'credit_minor' => $credits,
                ],
            ]);
        }

        // Per-transaction imbalance within the window. Grouped then compared in
        // PHP to stay dialect-agnostic (no alias-in-HAVING assumptions).
        $rows = LedgerEntry::whereBetween('posted_at', [$from, $to])
            ->selectRaw('transaction_ref, direction, SUM(amount_minor) as amt')
            ->groupBy('transaction_ref', 'direction')
            ->get();

        $byRef = [];
        foreach ($rows as $row) {
            $byRef[$row->transaction_ref][$row->direction] = (int) $row->amt;
        }

        foreach ($byRef as $ref => $sides) {
            $debit = $sides['debit'] ?? 0;
            $credit = $sides['credit'] ?? 0;

            if ($debit !== $credit) {
                $this->record($found, [
                    'type' => ReconciliationMismatch::TYPE_LEDGER_IMBALANCE,
                    'reference_type' => 'ledger_transaction',
                    'reference_id' => (string) $ref,
                    'expected_minor' => $credit,
                    'actual_minor' => $debit,
                    'details' => [
                        'message' => 'Transaction legs do not net to zero.',
                        'transaction_ref' => $ref,
                        'debit_minor' => $debit,
                        'credit_minor' => $credit,
                    ],
                ]);
            }
        }
    }

    /**
     * (2a) Every captured booking payment should have posted a
     * system:gateway_clearing → system:booking_revenue pair for its amount.
     * Grouped by booking (payable) because that is what the capture posting
     * references.
     */
    private function checkPayments(Carbon $from, Carbon $to, array &$found, array &$evaluatedTypes): void
    {
        $evaluatedTypes[ReconciliationMismatch::TYPE_PAYMENT_MISSING_LEDGER] = true;
        $evaluatedTypes[ReconciliationMismatch::TYPE_PAYMENT_AMOUNT_MISMATCH] = true;

        $groups = Payment::whereIn('status', self::CAPTURED_STATUSES)
            ->whereIn('payable_type', [RideBooking::class, TourBooking::class, CarRental::class])
            ->whereNotNull('payable_id')
            ->whereBetween('captured_at', [$from, $to])
            ->get()
            ->groupBy(fn (Payment $p) => $p->payable_type.'#'.$p->payable_id);

        foreach ($groups as $payments) {
            $payableType = $payments->first()->payable_type;
            $payableId = (string) $payments->first()->payable_id;
            $expected = (int) $payments->sum('amount_minor');
            $currency = $payments->first()->currency ?? 'INR';

            $actual = (int) LedgerEntry::query()
                ->where('reference_type', $payableType)
                ->where('reference_id', $payableId)
                ->where('direction', 'credit')
                ->whereHas('account', fn ($q) => $q->where('code', 'system:booking_revenue'))
                ->sum('amount_minor');

            $context = [
                'reference_type' => $payableType,
                'reference_id' => $payableId,
                'currency' => $currency,
                'provider_reference' => $payments->pluck('provider_payment_id')->filter()->implode(','),
                'details' => [
                    'payable' => class_basename($payableType).' #'.$payableId,
                    'payment_ids' => $payments->pluck('id')->all(),
                    'captured_minor' => $expected,
                    'revenue_posted_minor' => $actual,
                ],
            ];

            if ($actual === 0) {
                $this->record($found, array_merge($context, [
                    'type' => ReconciliationMismatch::TYPE_PAYMENT_MISSING_LEDGER,
                    'expected_minor' => $expected,
                    'actual_minor' => 0,
                ]));
            } elseif ($actual !== $expected) {
                $this->record($found, array_merge($context, [
                    'type' => ReconciliationMismatch::TYPE_PAYMENT_AMOUNT_MISMATCH,
                    'expected_minor' => $expected,
                    'actual_minor' => $actual,
                ]));
            }
        }
    }

    /**
     * (2b) Every processed payout should have posted a
     * system:payout_clearing → system:bank_settlement pair for its amount.
     */
    private function checkPayouts(Carbon $from, Carbon $to, array &$found, array &$evaluatedTypes): void
    {
        $evaluatedTypes[ReconciliationMismatch::TYPE_PAYOUT_MISSING_LEDGER] = true;
        $evaluatedTypes[ReconciliationMismatch::TYPE_PAYOUT_AMOUNT_MISMATCH] = true;

        $payouts = Payout::where('status', Payout::STATUS_PROCESSED)
            ->whereBetween('processed_at', [$from, $to])
            ->get();

        foreach ($payouts as $payout) {
            $expected = (int) $payout->amount_minor;

            $actual = (int) LedgerEntry::query()
                ->where('reference_type', 'payout')
                ->where('reference_id', (string) $payout->id)
                ->where('direction', 'debit')
                ->whereHas('account', fn ($q) => $q->where('code', 'system:payout_clearing'))
                ->sum('amount_minor');

            $context = [
                'reference_type' => 'payout',
                'reference_id' => (string) $payout->id,
                'currency' => $payout->currency ?? 'INR',
                'provider_reference' => $payout->provider_payout_id,
                'details' => [
                    'payout_number' => $payout->payout_number,
                    'processed_minor' => $expected,
                    'settlement_posted_minor' => $actual,
                ],
            ];

            if ($actual === 0) {
                $this->record($found, array_merge($context, [
                    'type' => ReconciliationMismatch::TYPE_PAYOUT_MISSING_LEDGER,
                    'expected_minor' => $expected,
                    'actual_minor' => 0,
                ]));
            } elseif ($actual !== $expected) {
                $this->record($found, array_merge($context, [
                    'type' => ReconciliationMismatch::TYPE_PAYOUT_AMOUNT_MISMATCH,
                    'expected_minor' => $expected,
                    'actual_minor' => $actual,
                ]));
            }
        }
    }

    /**
     * (3) Cross-check provider settlements. A provider that settled MORE than we
     * recorded as captured (net of refunds) is a real discrepancy — money moved
     * that we have no record of. The opposite direction is normal settlement lag
     * (T+n cycles) and is deliberately NOT flagged, to avoid nightly noise.
     */
    private function checkProviderSettlements(Carbon $from, Carbon $to, array &$found, array &$evaluatedTypes): string
    {
        $evaluatedTypes[ReconciliationMismatch::TYPE_PROVIDER_SETTLEMENT_MISMATCH] = true;
        $evaluatedTypes[ReconciliationMismatch::TYPE_PROVIDER_UNREACHABLE] = true;

        try {
            $payload = $this->razorpay->fetchSettlements($from->timestamp, $to->timestamp);
        } catch (Throwable $e) {
            $this->record($found, [
                'type' => ReconciliationMismatch::TYPE_PROVIDER_UNREACHABLE,
                'reference_type' => 'provider',
                'reference_id' => 'razorpay',
                'details' => [
                    'message' => 'Could not fetch provider settlements for the window.',
                    'error' => $e->getMessage(),
                ],
            ]);

            return 'unreachable';
        }

        $providerSettled = (int) collect($payload['items'] ?? [])->sum('amount');

        $captured = (int) Payment::whereIn('status', self::CAPTURED_STATUSES)
            ->whereBetween('captured_at', [$from, $to])
            ->sum('amount_minor');
        $refunded = (int) Payment::whereIn('status', self::CAPTURED_STATUSES)
            ->whereBetween('captured_at', [$from, $to])
            ->sum('amount_refunded_minor');
        $ourNet = $captured - $refunded;

        if ($providerSettled > $ourNet) {
            $this->record($found, [
                'type' => ReconciliationMismatch::TYPE_PROVIDER_SETTLEMENT_MISMATCH,
                'reference_type' => 'provider_settlement',
                'reference_id' => $from->toDateString().'..'.$to->toDateString(),
                'expected_minor' => $ourNet,
                'actual_minor' => $providerSettled,
                'details' => [
                    'message' => 'Provider settled more than our recorded net captures for the window.',
                    'our_net_minor' => $ourNet,
                    'provider_settled_minor' => $providerSettled,
                    'settlement_count' => count($payload['items'] ?? []),
                ],
            ]);
        }

        return 'ok';
    }

    // ── Persistence ────────────────────────────────────────────────────

    private function providerConfigured(): bool
    {
        $key = config('services.razorpay.key');

        return is_string($key) && $key !== '' && ! str_starts_with($key, 'your_');
    }

    /** Add a mismatch to the run set, keyed to dedupe repeats within one run. */
    private function record(array &$found, array $mismatch): void
    {
        $key = $this->key($mismatch['type'], $mismatch['reference_type'] ?? null, $mismatch['reference_id'] ?? null);
        $found[$key] = $mismatch;
    }

    /**
     * Upsert each found mismatch as an open row, preserving the original
     * detected_at across re-runs. Returns [opened, updated].
     *
     * @return array{0:int,1:int}
     */
    private function persist(string $runId, array $found): array
    {
        $opened = 0;
        $updated = 0;

        foreach ($found as $mismatch) {
            $row = ReconciliationMismatch::firstOrNew([
                'type' => $mismatch['type'],
                'reference_type' => $mismatch['reference_type'] ?? null,
                'reference_id' => $mismatch['reference_id'] ?? null,
                'status' => ReconciliationMismatch::STATUS_OPEN,
            ]);

            $row->run_id = $runId;
            $row->provider_reference = $mismatch['provider_reference'] ?? null;
            $row->expected_minor = $mismatch['expected_minor'] ?? null;
            $row->actual_minor = $mismatch['actual_minor'] ?? null;
            $row->currency = $mismatch['currency'] ?? 'INR';
            $row->details = $mismatch['details'] ?? null;

            if (! $row->exists) {
                $row->detected_at = now();
                $opened++;
            } else {
                $updated++;
            }

            $row->save();
        }

        return [$opened, $updated];
    }

    /**
     * Auto-resolve open rows whose type this run evaluated but whose reference is
     * no longer in the found set — i.e. the discrepancy cleared. Types the run
     * skipped (e.g. provider when unconfigured) are left untouched.
     */
    private function autoResolve(string $runId, array $found, array $evaluatedTypes): int
    {
        $resolved = 0;

        ReconciliationMismatch::open()
            ->whereIn('type', array_keys($evaluatedTypes))
            ->get()
            ->each(function (ReconciliationMismatch $row) use ($found, &$resolved) {
                $key = $this->key($row->type, $row->reference_type, $row->reference_id);

                if (! isset($found[$key])) {
                    $row->markResolved('auto:'.$row->run_id);
                    $resolved++;
                }
            });

        return $resolved;
    }

    private function key(string $type, ?string $referenceType, ?string $referenceId): string
    {
        return $type.'|'.($referenceType ?? '').'|'.($referenceId ?? '');
    }

    /** @return array<string,int> */
    private function countByType(array $found): array
    {
        $counts = [];
        foreach ($found as $mismatch) {
            $counts[$mismatch['type']] = ($counts[$mismatch['type']] ?? 0) + 1;
        }

        return $counts;
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Payout;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Services\LedgerService;
use App\Services\PaymentService;
use App\Services\RazorpayService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class AdminFinancialController extends Controller
{
    /**
     * List all wallets with transactions and stats.
     */
    public function wallets(Request $request)
    {
        $ownerType = $request->input('owner_type', 'driver'); // 'driver' or 'customer' or 'all'

        $query = Wallet::with(['owner', 'transactions' => function ($q) {
            $q->latest()->take(5);
        }]);

        if ($ownerType === 'driver') {
            $query->where('owner_type', 'App\Models\Driver');
        } elseif ($ownerType === 'customer') {
            $query->where('owner_type', 'App\Models\Customer');
        }

        $wallets = $query->paginate(15)->appends($request->all());

        return Inertia::render('admin/Financials/Wallets', [
            'title' => 'Driver & Customer Wallets',
            'user' => Auth::user(),
            'wallets' => $wallets,
            'filters' => [
                'owner_type' => $ownerType,
            ],
        ]);
    }

    /**
     * Perform a manual balance adjustment (credit or debit).
     */
    public function adjustWallet(Request $request, Wallet $wallet)
    {
        $validated = $request->validate([
            'type' => 'required|in:credit,debit',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:255',
        ]);

        $amount = (float) $validated['amount'];
        $type = $validated['type'];
        $description = '[Admin adjustment] '.$validated['description'];

        try {
            if ($type === 'credit') {
                $wallet->credit($amount, $description);
            } else {
                if (! $wallet->hasSufficientBalance($amount)) {
                    return back()->with('error', 'Insufficient balance for debit adjustment.');
                }
                $wallet->debit($amount, $description);
            }

            return back()->with('success', 'Wallet balance adjusted successfully.');
        } catch (\Exception $e) {
            return back()->with('error', 'Adjustment failed: '.$e->getMessage());
        }
    }

    /**
     * List all withdrawal requests.
     */
    public function withdrawals(Request $request)
    {
        $status = $request->input('status', 'all');

        $query = WithdrawalRequest::with('owner');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $withdrawals = $query->latest()->paginate(15)->appends($request->all());

        return Inertia::render('admin/Financials/Withdrawals', [
            'title' => 'Payout Requests',
            'user' => Auth::user(),
            'withdrawals' => $withdrawals,
            'filters' => [
                'status' => $status,
            ],
            'stats' => [
                'pending_count' => WithdrawalRequest::where('status', 'pending')->count(),
                'processing_count' => WithdrawalRequest::where('status', 'processing')->count(),
                'completed_sum' => WithdrawalRequest::where('status', 'completed')->sum('amount'),
            ],
        ]);
    }

    /**
     * Approve a pending withdrawal request: open a Payout and initiate it at the
     * provider. Funds were already held (wallet → system:payout_clearing) when the
     * request was created, so approval moves no money — it only fires the payout.
     * The payout.processed webhook (or manual completion) settles it later.
     */
    public function approveWithdrawal(Request $request, WithdrawalRequest $withdrawal, PaymentService $payments, RazorpayService $razorpay)
    {
        if (! $withdrawal->isPending()) {
            return back()->with('error', 'Only pending requests can be approved.');
        }

        $details = $withdrawal->account_details ?? [];
        $payout = null;

        try {
            // Reuse a still-live payout on a re-click; open a fresh one otherwise
            // (a prior attempt that failed is terminal, so we start clean).
            $payout = $withdrawal->payout;
            if (! $payout || $payout->isTerminal()) {
                $payout = $payments->createPayout($withdrawal, Money::toMinor((float) $withdrawal->amount));
            }

            // Ensure a provider fund account exists for the payee's bank details.
            $fundAccountId = $withdrawal->razorpay_fund_account_id;
            if (! $fundAccountId) {
                $owner = $withdrawal->owner;
                $contact = $razorpay->createContact(
                    (string) ($owner->name ?? 'Payee'),
                    (string) ($owner->email ?? ''),
                    (string) ($owner->phone ?? ''),
                    'vendor'
                );
                $fundAccount = $razorpay->createFundAccount(
                    (string) $contact['id'],
                    (string) ($details['name'] ?? $owner->name ?? ''),
                    (string) ($details['ifsc'] ?? ''),
                    (string) ($details['account_number'] ?? ''),
                );
                $fundAccountId = $fundAccount['id'];
                $withdrawal->update(['razorpay_fund_account_id' => $fundAccountId]);
            }

            // Initiate the payout at the provider (amount in major units / INR).
            $providerPayout = $razorpay->createPayout(
                (float) $withdrawal->amount,
                (string) $fundAccountId,
                'payout',
                $payout->payout_number,
            );

            $providerPayoutId = $providerPayout['id'] ?? null;
            $payout->markQueued($providerPayoutId);
            $withdrawal->update(['razorpay_payout_id' => $providerPayoutId]);
            $withdrawal->markAsProcessing();

            return back()->with('success', 'Withdrawal approved — payout initiated to the payee.');
        } catch (\Throwable $e) {
            // Provider rejected the payout before it was queued: fail this attempt
            // but keep the request pending (funds stay held) so an admin can retry
            // or reject. Only a not-yet-queued payout is failed here.
            if ($payout && $payout->status === Payout::STATUS_CREATED) {
                $payout->markFailed('approval_error', $e->getMessage());
            }
            Log::error('Withdrawal approval / payout initiation failed', [
                'withdrawal_id' => $withdrawal->id,
                'exception' => $e::class,
            ]);

            return back()->with('error', 'Payout initiation failed: '.$e->getMessage());
        }
    }

    /**
     * Reject a pending withdrawal request and refund wallet.
     */
    public function rejectWithdrawal(Request $request, WithdrawalRequest $withdrawal)
    {
        if (! $withdrawal->isPending() && ! $withdrawal->isProcessing()) {
            return back()->with('error', 'This request cannot be rejected.');
        }

        $validated = $request->validate([
            'rejection_reason' => 'required|string|max:255',
            'admin_notes' => 'nullable|string|max:255',
        ]);

        DB::beginTransaction();
        try {
            $wallet = Wallet::where('owner_type', $withdrawal->owner_type)
                ->where('owner_id', $withdrawal->owner_id)
                ->first();

            if ($wallet) {
                // Release the hold back to the wallet. The 'driver_withdrawal' ref
                // nets system:payout_clearing to zero; the shared release key makes
                // a double-reject (or a later payout.failed webhook) a no-op.
                $wallet->credit(
                    (float) $withdrawal->amount,
                    'Refund: Withdrawal request rejected - ID #'.$withdrawal->id,
                    'driver_withdrawal',
                    (string) $withdrawal->id,
                    'withdrawal_release:'.$withdrawal->id
                );
            }

            $withdrawal->reject(Auth::id(), $validated['rejection_reason'], $validated['admin_notes'] ?? null);

            DB::commit();

            return back()->with('success', 'Withdrawal request rejected and amount refunded.');
        } catch (\Exception $e) {
            DB::rollBack();

            return back()->with('error', 'Rejection failed: '.$e->getMessage());
        }
    }

    /**
     * Mark a processing withdrawal as completed with a UTR. Settles the held
     * funds (system:payout_clearing → system:bank_settlement) via the payout —
     * the same idempotent path the payout.processed webhook uses — so a manual
     * confirmation and a provider webhook can never double-settle.
     */
    public function completeWithdrawal(Request $request, WithdrawalRequest $withdrawal, PaymentService $payments, LedgerService $ledger)
    {
        if (! $withdrawal->isProcessing()) {
            return back()->with('error', 'Only processing requests can be completed.');
        }

        $validated = $request->validate([
            'utr_number' => 'required|string|max:100',
        ]);

        DB::beginTransaction();
        try {
            $payout = $withdrawal->payout;

            if ($payout) {
                // Idempotent: posts the settlement pair and completes the request.
                $payments->markPayoutProcessed($payout, $validated['utr_number']);
            } else {
                // No payout row (out-of-band manual transfer): settle clearing →
                // bank directly, then complete.
                $ledger->post(
                    'system:payout_clearing',
                    'system:bank_settlement',
                    Money::toMinor((float) $withdrawal->amount),
                    [
                        'reference_type' => 'payout',
                        'reference_id' => (string) $withdrawal->id,
                        'description' => 'Manual driver payout settlement — withdrawal #'.$withdrawal->id,
                    ]
                );
                $withdrawal->markAsCompleted($validated['utr_number']);
            }

            DB::commit();

            return back()->with('success', 'Withdrawal marked as completed successfully.');
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Withdrawal completion failed', [
                'withdrawal_id' => $withdrawal->id,
                'exception' => $e::class,
            ]);

            return back()->with('error', 'Completion failed: '.$e->getMessage());
        }
    }
}

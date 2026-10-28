<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Customer/driver withdrawal endpoints (SKY-MRD-001 §6.1). Only index + store
 * are routed (routes/api.php). Admin review/approval/completion lives in the
 * web AdminFinancialController, and the payout itself is carried by the Payout
 * domain model — see PaymentService::createPayout / markPayoutProcessed.
 */
class WithdrawalController extends Controller
{
    public function __construct(protected NotificationService $notification) {}

    /**
     * List the authenticated user's withdrawal requests.
     */
    public function index(Request $request)
    {
        $withdrawals = WithdrawalRequest::forOwner($request->user())
            ->latest()
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $withdrawals,
        ]);
    }

    /**
     * Create a withdrawal request and hold the funds.
     *
     * Holding = debit the wallet into system:payout_clearing (reference type
     * 'driver_withdrawal'). The funds leave clearing only when an admin approves
     * and the payout settles, and are released back to the wallet if the request
     * is rejected or the payout fails. Request-level idempotency is enforced by
     * the 'idempotency' middleware on the route.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|decimal:0,2|min:100',
            'bank_account_name' => 'required|string|max:255',
            'bank_account_number' => 'required|string|between:9,18',
            'bank_ifsc' => 'required|string|size:11',
            'bank_name' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        $wallet = Wallet::forOwner($user)->first();

        if (! $wallet) {
            return response()->json([
                'success' => false,
                'message' => 'Wallet not found',
            ], 404);
        }

        if (! $wallet->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Wallet is not active',
            ], 400);
        }

        if (! $wallet->hasSufficientBalance((float) $request->amount)) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient wallet balance',
            ], 400);
        }

        try {
            $withdrawal = DB::transaction(function () use ($request, $user, $wallet) {
                // Create first so the ledger hold can reference the request id.
                $withdrawal = WithdrawalRequest::create([
                    'owner_type' => $user::class,
                    'owner_id' => $user->id,
                    'amount' => $request->amount,
                    'method' => 'bank_transfer',
                    'account_details' => [
                        'name' => $request->bank_account_name,
                        'account_number' => $request->bank_account_number,
                        'ifsc' => $request->bank_ifsc,
                        'bank' => $request->bank_name,
                    ],
                    'status' => 'pending',
                ]);

                // Hold the funds: wallet → system:payout_clearing.
                $wallet->debit(
                    (float) $request->amount,
                    'Withdrawal request #'.$withdrawal->id,
                    'driver_withdrawal',
                    (string) $withdrawal->id,
                    'withdrawal_hold:'.$withdrawal->id
                );

                return $withdrawal;
            });
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create withdrawal request: '.$e->getMessage(),
            ], 500);
        }

        $this->notification->sendWalletNotification($user, [
            'type' => 'Withdrawal Request',
            'amount' => $request->amount,
            'balance' => $wallet->fresh()->balance,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Withdrawal request submitted successfully',
            'data' => $withdrawal,
        ]);
    }
}

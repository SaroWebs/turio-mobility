<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessRazorpayWebhookEvent;
use App\Models\RazorpayWebhookEvent;
use App\Models\RideBooking;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\CommissionService;
use App\Services\RazorpayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    protected RazorpayService $razorpay;

    public function __construct(RazorpayService $razorpay)
    {
        $this->razorpay = $razorpay;
    }

    /**
     * Get user's wallet
     */
    public function getWallet(Request $request)
    {
        $wallet = $this->walletFor($request);

        $walletData = $wallet->toArray();
        if ($request->user()->isDriver()) {
            $walletData = array_merge($walletData, app(\App\Services\DriverWithdrawalPolicy::class)->summary($wallet));
            $earnings = RideBooking::where('driver_id', $request->user()->id)
                ->where('status', 'completed');
            $walletData['total_earnings'] = (float) (clone $earnings)->sum('driver_share');
            $walletData['weekly_earnings'] = (float) (clone $earnings)
                ->where('completed_at', '>=', now()->subWeek())
                ->sum('driver_share');

            $minTopUp = (int) setting('driver.minimum_topup_minor', 50000);
            $dispatchMin = (int) setting('driver.dispatch_eligible_balance_minor', 10000);
            $warningThreshold = (int) setting('driver.warning_balance_minor', 50000);
            $balanceMinor = $wallet->getBalanceMinor();

            $walletData['minimum_topup_minor'] = $minTopUp;
            $walletData['minimum_topup'] = round($minTopUp / 100, 2);
            $walletData['dispatch_eligible_balance_minor'] = $dispatchMin;
            $walletData['dispatch_eligible_balance'] = round($dispatchMin / 100, 2);
            $walletData['warning_balance_minor'] = $warningThreshold;
            $walletData['warning_balance'] = round($warningThreshold / 100, 2);
            $walletData['needs_topup_warning'] = $balanceMinor < $warningThreshold;
            $walletData['is_dispatch_eligible'] = $balanceMinor >= $dispatchMin;
            $walletData['is_blocked_low_balance'] = $balanceMinor < $dispatchMin;
        }

        return response()->json([
            'success' => true,
            'data' => $walletData,
        ]);
    }

    /**
     * Get wallet transactions
     */
    public function getTransactions(Request $request)
    {
        $wallet = $this->walletFor($request);

        $transactions = WalletTransaction::where('wallet_id', $wallet->id)
            ->latest()
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $transactions,
        ]);
    }

    /**
     * Create a payment order for wallet top-up
     */
    public function createTopUpOrder(Request $request)
    {
        $minTopUp = $request->user()->isDriver() ? ((int) setting('driver.minimum_topup_minor', 50000) / 100) : 100;
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:'.$minTopUp.'|max:100000',
        ], [
            'amount.min' => 'The minimum top-up amount is ₹'.$minTopUp.'.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $wallet = Wallet::firstOrCreate(
            ['owner_type' => $request->user()::class, 'owner_id' => $request->user()->id],
            [
                'balance' => 0,
                'balance_minor' => 0,
                'currency' => 'INR',
                'is_active' => true,
            ]
        );

        if (! $wallet->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Wallet is not active',
            ], 400);
        }

        try {
            $receipt = 'WALLET_'.$request->user()->id.'_'.Str::random(8);

            $order = $this->razorpay->createOrder(
                $request->amount,
                $receipt,
                [
                    'user_id' => $request->user()->id,
                    'wallet_id' => $wallet->id,
                    'purpose' => 'wallet_topup',
                ]
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'order_id' => $order['id'],
                    'id' => $order['id'],
                    'amount' => $request->amount,
                    'currency' => 'INR',
                    'receipt' => $receipt,
                    'is_simulation' => rescue(fn () => $this->razorpay->isSimulationMode(), false, false),
                    'razorpay_config' => rescue(fn () => $this->razorpay->getClientConfig(), [], false),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create payment order: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Verify and complete wallet top-up after payment
     */
    public function verifyTopUp(Request $request)
    {
        $orderId = $request->input('razorpay_order_id') ?? $request->input('order_id');
        $paymentId = $request->input('razorpay_payment_id') ?? $request->input('payment_id');
        $signature = $request->input('razorpay_signature') ?? $request->input('signature') ?? 'sig_demo_'.time();
        $idempotencyKey = $request->input('idempotency_key')
            ?: ($orderId && $paymentId ? "wallet_topup:{$orderId}:{$paymentId}" : null);

        if (! $orderId || ! $paymentId) {
            return response()->json([
                'success' => false,
                'message' => 'Missing order ID or payment ID.',
            ], 422);
        }

        // Verify signature
        $isValid = $this->razorpay->verifySignature(
            $orderId,
            $paymentId,
            $signature
        );

        if (! $isValid) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid payment signature',
            ], 400);
        }

        try {
            $payment = $this->razorpay->fetchPayment($paymentId);
            $order = $this->razorpay->fetchOrder($orderId);

            if (($payment['order_id'] ?? null) !== $orderId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Payment does not match order',
                ], 400);
            }

            if (($payment['status'] ?? null) !== 'captured') {
                return response()->json([
                    'success' => false,
                    'message' => 'Payment is not captured',
                ], 400);
            }

            $amount = ((int) ($payment['amount'] ?? 0)) / 100;
            $orderAmount = ((int) ($order['amount'] ?? 0)) / 100;

            if ($amount <= 0 || $amount !== $orderAmount) {
                return response()->json([
                    'success' => false,
                    'message' => 'Payment amount mismatch',
                ], 400);
            }

            $wallet = Wallet::query()
                ->where('owner_type', $request->user()::class)
                ->where('owner_id', $request->user()->id)
                ->first();

            if (! $wallet) {
                return response()->json([
                    'success' => false,
                    'message' => 'Wallet not found',
                ], 404);
            }

            $transaction = $wallet->credit(
                $amount,
                'Wallet top-up via Razorpay',
                'razorpay_payment',
                $paymentId,
                $idempotencyKey
            );

            // If driver, activate funding status upon successful top-up
            if ($request->user() instanceof \App\Models\Driver) {
                $request->user()->update([
                    'funding_eligible' => true,
                    'funding_activated_at' => now(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Wallet topped up successfully',
                'data' => [
                    'wallet' => $wallet->fresh(),
                    'amount' => $amount,
                    'payment_id' => $paymentId,
                    'transaction_id' => $transaction->id,
                    'idempotency_key' => $transaction->idempotency_key,
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Wallet top-up verification failed', [
                'user_id' => $request->user()->id,
                'order_id' => $orderId,
                'payment_id' => $paymentId,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Top-up verification failed: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Withdraw from wallet
     */
    public function withdraw(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:100',
            'bank_account' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $wallet = Wallet::forOwner($request->user())->first();

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

        if ($wallet->getBalance() < $request->amount) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient wallet balance',
            ], 400);
        }

        // Process withdrawal
        $commissionService = new CommissionService;
        $success = $commissionService->processDriverWithdrawal(
            $request->user()->id,
            $request->amount,
            'Withdrawal to bank account: '.$request->bank_account
        );

        if (! $success) {
            return response()->json([
                'success' => false,
                'message' => 'Withdrawal failed',
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Withdrawal processed successfully',
        ]);
    }

    /**
     * Get wallet statistics
     */
    public function getStats(Request $request)
    {
        $wallet = Wallet::forOwner($request->user())->first();

        if (! $wallet) {
            return response()->json([
                'success' => false,
                'message' => 'Wallet not found',
            ], 404);
        }

        $commissionService = new CommissionService;
        $stats = $request->user()->isDriver()
            ? $commissionService->getDriverCommissionStats($request->user()->id)
            : null;

        return response()->json([
            'success' => true,
            'data' => [
                'wallet_balance' => $wallet->getBalance(),
                'commission_stats' => $stats,
            ],
        ]);
    }

    /**
     * Get Razorpay client configuration
     */
    public function getRazorpayConfig(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => $this->razorpay->getClientConfig(),
        ]);
    }

    public function handleRazorpayWebhook(Request $request)
    {
        $signature = $request->header('X-Razorpay-Signature');
        $payload = $request->getContent();

        if (! $signature || ! $this->razorpay->verifyWebhook($payload, $signature)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook signature',
            ], 400);
        }

        $data = json_decode($payload, true) ?: [];
        $eventType = $data['event'] ?? 'unknown';

        // Idempotency key: prefer Razorpay's delivery id header, else derive one
        // deterministically from the event + entity so redeliveries still dedupe.
        $eventId = $request->header('X-Razorpay-Event-Id')
            ?: $this->deriveWebhookEventId($eventType, $data);

        // Persist the raw event before any side effect (§8.7). Unique on
        // (provider, event_id) so a redelivery resolves to the same row.
        $event = RazorpayWebhookEvent::firstOrCreate(
            ['provider' => 'razorpay', 'event_id' => $eventId],
            [
                'event_type' => $eventType,
                'payload' => $data,
                'signature' => $signature,
                'status' => RazorpayWebhookEvent::STATUS_RECEIVED,
            ]
        );

        // Only kick off processing on first receipt; redeliveries are a no-op.
        if ($event->wasRecentlyCreated) {
            ProcessRazorpayWebhookEvent::dispatch($event->id);
        }

        // Return 2xx fast — processing is async (queued) in production.
        return response()->json([
            'success' => true,
            'message' => 'Webhook received.',
            'event' => $eventType,
        ], 200);
    }

    /** Deterministic dedup key when Razorpay omits its X-Razorpay-Event-Id header. */
    private function deriveWebhookEventId(string $eventType, array $data): string
    {
        $entityId = data_get($data, 'payload.payment.entity.id')
            ?? data_get($data, 'payload.refund.entity.id')
            ?? data_get($data, 'payload.payout.entity.id')
            ?? data_get($data, 'payload.order.entity.id')
            ?? '';

        return $eventType.':'.$entityId.':'.substr(hash('sha256', json_encode($data)), 0, 16);
    }

    private function walletFor(Request $request): Wallet
    {
        $owner = $request->user();

        return Wallet::firstOrCreate([
            'owner_type' => $owner::class,
            'owner_id' => $owner->id,
        ], [
            'balance' => 0,
            'currency' => 'INR',
            'is_active' => true,
        ]);
    }
}

<?php

namespace App\Services;

use App\Exceptions\ProviderUnavailableException;
use App\Support\CircuitBreaker;
use Closure;
use Exception;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RazorpayService
{
    protected string $apiKey;

    protected string $apiSecret;

    protected string $baseUrl;

    protected string $webhookSecret;

    protected int $connectTimeout;

    protected int $timeout;

    protected int $getRetries;

    protected int $retryDelayMs;

    public function __construct()
    {
        $this->apiKey = config('services.razorpay.key') ?? '';
        $this->apiSecret = config('services.razorpay.secret') ?? '';
        $this->webhookSecret = config('services.razorpay.webhook_secret') ?? '';
        $this->baseUrl = 'https://api.razorpay.com/v1';
        $this->connectTimeout = (int) config('resilience.http.razorpay.connect_timeout', 5);
        $this->timeout = (int) config('resilience.http.razorpay.timeout', 20);
        $this->getRetries = (int) config('resilience.http.razorpay.get_retries', 2);
        $this->retryDelayMs = (int) config('resilience.http.razorpay.retry_delay_ms', 250);
    }

    public function isSimulationMode(): bool
    {
        if (config('services.razorpay.simulation') === true || env('PAYMENT_SIMULATION') === true || env('PAYMENT_SIMULATION') === 'true') {
            return true;
        }

        if (empty($this->apiKey) || str_contains($this->apiKey, 'xxxx') || str_contains($this->apiKey, 'your_') || str_contains($this->apiSecret, 'your_')) {
            return true;
        }

        return false;
    }

    /**
     * Base HTTP client for Razorpay: authenticated and always time-bounded so a
     * slow gateway can never pin a request thread or queue worker. Read-only
     * (`$retryable`) calls retry a dropped connection; state-changing POSTs do
     * not (see send() callers) to avoid double-submitting money operations.
     */
    private function client(bool $retryable = false): PendingRequest
    {
        $request = Http::withBasicAuth($this->apiKey, $this->apiSecret)
            ->connectTimeout($this->connectTimeout)
            ->timeout($this->timeout);

        if ($retryable && $this->getRetries > 0) {
            // No ->throw(), so retry only fires on ConnectionException (transport
            // failures) — never on a 4xx/5xx response body.
            $request->retry($this->getRetries, $this->retryDelayMs);
        }

        return $request;
    }

    /**
     * Run a Razorpay HTTP call under the circuit breaker. A connection failure
     * or a 5xx response counts as a provider failure (and can trip the breaker);
     * a 4xx is returned to the caller to handle as a domain error without
     * tripping the breaker.
     */
    private function send(string $operation, Closure $request): Response
    {
        return CircuitBreaker::for('razorpay')->run(function () use ($operation, $request) {
            $response = $request();

            if ($response->serverError()) {
                Log::error("Razorpay {$operation} provider error", [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                throw new ProviderUnavailableException("Razorpay {$operation} failed with status {$response->status()}.");
            }

            return $response;
        });
    }

    /**
     * Create a Razorpay order
     *
     * @param  float  $amount  Amount in INR
     * @param  string  $receipt  Unique receipt ID
     * @param  array  $notes  Additional notes
     *
     * @throws Exception
     */
    public function createOrder(float $amount, string $receipt, array $notes = []): array
    {
        if ($this->isSimulationMode()) {
            $amountMinor = \App\Support\Money::toMinor($amount);
            $orderId = 'order_demo_'.Str::random(14);
            $orderData = [
                'id' => $orderId,
                'entity' => 'order',
                'amount' => $amountMinor,
                'amount_paid' => 0,
                'amount_due' => $amountMinor,
                'currency' => 'INR',
                'receipt' => $receipt,
                'status' => 'created',
                'attempts' => 0,
                'notes' => array_merge([
                    'purpose' => 'wallet_topup',
                    'is_simulation' => true,
                    'created_at' => now()->toIso8601String(),
                ], $notes),
                'created_at' => now()->timestamp,
            ];

            Cache::put('sim_razorpay_order:'.$orderId, $orderData, now()->addDays(7));

            return $orderData;
        }

        try {
            $response = $this->send('order creation', fn () => $this->client()
                ->post("{$this->baseUrl}/orders", [
                    'amount' => \App\Support\Money::toMinor($amount),
                    'currency' => 'INR',
                    'receipt' => $receipt,
                    'notes' => array_merge([
                        'purpose' => 'wallet_topup',
                        'created_at' => now()->toIso8601String(),
                    ], $notes),
                    'payment_capture' => 1, // Auto capture
                ]));

            if (! $response->successful()) {
                Log::error('Razorpay order creation failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                throw new Exception('Failed to create payment order');
            }

            return $response->json();
        } catch (Exception $e) {
            Log::error('Razorpay order creation exception', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Verify payment signature
     */
    public function verifySignature(string $orderId, string $paymentId, string $signature): bool
    {
        if ($this->isSimulationMode() || str_contains($orderId, 'demo') || str_contains($paymentId, 'demo') || str_contains($paymentId, 'sim')) {
            return true;
        }

        $data = $orderId.'|'.$paymentId;
        $expectedSignature = hash_hmac('sha256', $data, $this->apiSecret);

        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Fetch payment details
     *
     * @throws Exception
     */
    public function fetchPayment(string $paymentId): array
    {
        if ($this->isSimulationMode() || str_contains($paymentId, 'demo') || str_contains($paymentId, 'sim')) {
            $orderId = request('razorpay_order_id') ?? request('order_id');
            $cached = $orderId ? Cache::get('sim_razorpay_order:'.$orderId) : null;
            $local = $orderId ? \App\Models\PaymentOrder::where('provider_order_id', $orderId)->first() : null;
            $amount = $cached ? (int) $cached['amount'] : ($local ? (int) $local->amount_minor : (request('amount') ? \App\Support\Money::toMinor((float) request('amount')) : 50000));

            return [
                'id' => $paymentId,
                'entity' => 'payment',
                'amount' => $amount,
                'currency' => 'INR',
                'status' => 'captured',
                'order_id' => $orderId ?: 'order_demo_simulated',
                'invoice_id' => null,
                'international' => false,
                'method' => 'upi',
                'amount_refunded' => 0,
                'refund_status' => null,
                'captured' => true,
                'description' => 'Demo Simulated Payment',
                'card_id' => null,
                'bank' => null,
                'wallet' => null,
                'vpa' => 'demo@upi',
                'email' => auth()->user()?->email ?? 'demo@example.com',
                'contact' => auth()->user()?->phone ?? '9999999999',
                'fee' => 0,
                'tax' => 0,
                'error_code' => null,
                'error_description' => null,
                'created_at' => now()->timestamp,
            ];
        }

        try {
            $response = $this->send('fetch payment', fn () => $this->client(retryable: true)
                ->get("{$this->baseUrl}/payments/{$paymentId}"));

            if (! $response->successful()) {
                throw new Exception('Failed to fetch payment details');
            }

            return $response->json();
        } catch (Exception $e) {
            Log::error('Razorpay fetch payment exception', [
                'payment_id' => $paymentId,
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Fetch order details
     *
     * @throws Exception
     */
    public function fetchOrder(string $orderId): array
    {
        if ($this->isSimulationMode() || str_contains($orderId, 'demo') || str_contains($orderId, 'sim')) {
            $cached = Cache::get('sim_razorpay_order:'.$orderId);
            if ($cached) {
                return $cached;
            }

            $local = \App\Models\PaymentOrder::where('provider_order_id', $orderId)->first();
            $amount = $local ? (int) $local->amount_minor : 50000;

            return [
                'id' => $orderId,
                'entity' => 'order',
                'amount' => $amount,
                'amount_paid' => $amount,
                'amount_due' => 0,
                'currency' => 'INR',
                'receipt' => $local?->receipt ?? 'sim_receipt',
                'status' => 'paid',
                'attempts' => 1,
                'notes' => $local?->notes ?? ['is_simulation' => true],
                'created_at' => now()->timestamp,
            ];
        }

        try {
            $response = $this->send('fetch order', fn () => $this->client(retryable: true)
                ->get("{$this->baseUrl}/orders/{$orderId}"));

            if (! $response->successful()) {
                throw new Exception('Failed to fetch order details');
            }

            return $response->json();
        } catch (Exception $e) {
            Log::error('Razorpay fetch order exception', [
                'order_id' => $orderId,
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Fetch settlements credited to the merchant account in a time window.
     * Read-only, so it uses the retryable client. Consumed by the reconciliation
     * sweep to cross-check provider settlement against our ledger
     * (SKY-MRD-001 §13.3).
     *
     * @param  int  $fromTs  Unix timestamp, inclusive
     * @param  int  $toTs  Unix timestamp, inclusive
     * @return array Razorpay settlement collection payload ({entity, count, items})
     *
     * @throws Exception on provider failure (caller records provider_unreachable)
     */
    public function fetchSettlements(int $fromTs, int $toTs, int $count = 100): array
    {
        try {
            $response = $this->send('fetch settlements', fn () => $this->client(retryable: true)
                ->get("{$this->baseUrl}/settlements", [
                    'from' => $fromTs,
                    'to' => $toTs,
                    'count' => $count,
                ]));

            if (! $response->successful()) {
                throw new Exception('Failed to fetch settlements');
            }

            return $response->json();
        } catch (Exception $e) {
            Log::error('Razorpay fetch settlements exception', [
                'from' => $fromTs,
                'to' => $toTs,
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Process refund
     *
     * @param  float  $amount  Amount in INR (optional, defaults to full refund)
     *
     * @throws Exception
     */
    public function refund(string $paymentId, ?float $amount = null, string $reason = ''): array
    {
        try {
            $payload = [
                'notes' => [
                    'reason' => $reason,
                    'refunded_at' => now()->toIso8601String(),
                ],
            ];

            if ($amount !== null) {
                $payload['amount'] = (int) ($amount * 100); // Convert to paise
            }

            $response = $this->send('refund', fn () => $this->client()
                ->post("{$this->baseUrl}/payments/{$paymentId}/refund", $payload));

            if (! $response->successful()) {
                throw new Exception('Failed to process refund');
            }

            return $response->json();
        } catch (Exception $e) {
            Log::error('Razorpay refund exception', [
                'payment_id' => $paymentId,
                'amount' => $amount,
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Verify webhook signature
     */
    public function verifyWebhook(string $payload, string $signature): bool
    {
        $expectedSignature = hash_hmac('sha256', $payload, $this->webhookSecret);

        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Create a payout to bank account (for driver withdrawals)
     *
     * @param  float  $amount  Amount in INR
     * @param  string  $fundAccountId  Razorpay fund account ID
     * @param  string  $purpose  Purpose of payout
     * @param  string  $referenceId  Reference ID for tracking
     *
     * @throws Exception
     */
    public function createPayout(float $amount, string $fundAccountId, string $purpose, string $referenceId): array
    {
        try {
            $response = $this->send('payout creation', fn () => $this->client()
                ->post("{$this->baseUrl}/payouts", [
                    'account_number' => config('services.razorpay.merchant_account'),
                    'fund_account_id' => $fundAccountId,
                    'amount' => (int) ($amount * 100), // Convert to paise
                    'currency' => 'INR',
                    'mode' => 'IMPS',
                    'purpose' => $purpose,
                    'queue_if_low_balance' => true,
                    'reference_id' => $referenceId,
                    'narration' => 'Turiya Mobility Driver Payout',
                ]));

            if (! $response->successful()) {
                Log::error('Razorpay payout creation failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                throw new Exception('Failed to create payout');
            }

            return $response->json();
        } catch (Exception $e) {
            Log::error('Razorpay payout exception', [
                'message' => $e->getMessage(),
                'amount' => $amount,
                'fund_account_id' => $fundAccountId,
            ]);
            throw $e;
        }
    }

    /**
     * Create a fund account for bank transfers
     *
     * @param  string  $contactId  Razorpay contact ID
     * @param  string  $accountName  Bank account holder name
     * @param  string  $ifsc  Bank IFSC code
     * @param  string  $accountNumber  Bank account number
     *
     * @throws Exception
     */
    public function createFundAccount(string $contactId, string $accountName, string $ifsc, string $accountNumber): array
    {
        try {
            $response = $this->send('fund account creation', fn () => $this->client()
                ->post("{$this->baseUrl}/fund_accounts", [
                    'contact_id' => $contactId,
                    'account_type' => 'bank_account',
                    'bank_account' => [
                        'name' => $accountName,
                        'ifsc' => $ifsc,
                        'account_number' => $accountNumber,
                    ],
                ]));

            if (! $response->successful()) {
                throw new Exception('Failed to create fund account');
            }

            return $response->json();
        } catch (Exception $e) {
            Log::error('Razorpay fund account creation exception', [
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Create a contact for payouts
     *
     * @param  string  $name  Contact name
     * @param  string  $email  Contact email
     * @param  string  $phone  Contact phone
     * @param  string  $type  Contact type (vendor/employee/customer)
     *
     * @throws Exception
     */
    public function createContact(string $name, string $email, string $phone, string $type = 'vendor'): array
    {
        try {
            $response = $this->send('contact creation', fn () => $this->client()
                ->post("{$this->baseUrl}/contacts", [
                    'name' => $name,
                    'email' => $email,
                    'contact' => $phone,
                    'type' => $type,
                    'reference_id' => 'contact_'.uniqid(),
                ]));

            if (! $response->successful()) {
                throw new Exception('Failed to create contact');
            }

            return $response->json();
        } catch (Exception $e) {
            Log::error('Razorpay contact creation exception', [
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Get client configuration for frontend
     */
    public function getClientConfig(): array
    {
        return [
            'key' => $this->apiKey,
            'currency' => 'INR',
            'name' => config('app.name', 'Turiya Mobility'),
            'image' => asset('logo.svg'),
            'is_simulation' => $this->isSimulationMode(),
            'prefill' => [
                'name' => auth()->user()?->name ?? '',
                'email' => auth()->user()?->email ?? '',
                'contact' => auth()->user()?->phone ?? '',
            ],
            'theme' => [
                'color' => '#F97316',
            ],
        ];
    }
}

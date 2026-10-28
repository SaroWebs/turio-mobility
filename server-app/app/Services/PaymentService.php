<?php

namespace App\Services;

use App\Models\CarRental;
use App\Models\Payment;
use App\Models\PaymentOrder;
use App\Models\Payout;
use App\Models\RideBooking;
use App\Models\TourBooking;
use App\Models\WithdrawalRequest;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Owns the payment/order/payout state machine (SKY-MRD-001 §6.1) and its
 * ledger consequences. This is the seam the Razorpay webhook processor drives
 * (item #3): it records captures/failures/payouts idempotently and mirrors the
 * booking `payment_status` for legacy clients.
 */
class PaymentService
{
    public function __construct(private LedgerService $ledger) {}

    public function recordAdminReceipt(Model $booking, string $method, ?string $reference, int $adminId): Payment
    {
        return DB::transaction(function () use ($booking, $method, $reference, $adminId) {
            $booking = $booking->newQuery()->lockForUpdate()->findOrFail($booking->id);
            abort_if($booking instanceof TourBooking && $booking->payment_plan, 422, 'Use verified online checkout for deposit bookings.');
            abort_unless(in_array($method, ['cash', 'card', 'upi', 'bank_transfer'], true), 422, 'Use verified provider checkout or the customer wallet flow for this payment method.');
            abort_if($booking->status === 'cancelled' || $booking->payment_status === 'refunded', 422, 'Closed or refunded bookings cannot be confirmed.');
            $existing = $booking->payments()->where('provider', 'manual')->whereNotNull('captured_at')->first();
            if ($existing) {
                return $existing;
            }
            abort_if($booking->payment_status === 'paid', 422, 'This booking already has a recorded payment.');
            if ($booking instanceof TourBooking) {
                $this->confirmTourBooking($booking);
            }

            return $this->recordCapturedPayment([
                'provider' => 'manual', 'provider_payment_id' => 'manual_'.class_basename($booking).'_'.$booking->id,
                'payable' => $booking->fresh(), 'owner' => $booking->customer,
                'amount_minor' => \App\Support\Money::toMinor($booking instanceof RideBooking ? $booking->total_fare : $booking->total_price),
                'method' => $method, 'notes' => ['admin_id' => $adminId, 'receipt_reference' => $reference, 'source' => 'admin_attestation'],
            ]);
        });
    }

    public function payTourWithWallet(TourBooking $booking): Payment
    {
        return DB::transaction(function () use ($booking) {
            $booking = TourBooking::lockForUpdate()->findOrFail($booking->id);
            abort_if($booking->payment_plan, 422, 'Stored wallet funds cannot replace the required online deposit.');
            $existing = $booking->payments()->where('provider', 'wallet')->whereNotNull('captured_at')->first();
            if ($existing) {
                return $existing;
            }
            abort_unless($booking->payment_status === 'pending' && $booking->status === 'pending', 422, 'This booking is no longer payable.');
            $this->confirmTourBooking($booking);
            $wallet = \App\Models\Wallet::forOwner($booking->customer)->firstOrFail();
            $wallet->debit((float) $booking->total_price, 'Payment for Tour Booking #'.$booking->id, 'tour_booking', $booking->id, 'tour-wallet:'.$booking->id);

            return $this->recordCapturedPayment([
                'provider' => 'wallet', 'provider_payment_id' => 'wallet_tour_'.$booking->id,
                'payable' => $booking->fresh(), 'owner' => $booking->customer,
                'amount_minor' => \App\Support\Money::toMinor($booking->total_price), 'method' => 'wallet',
            ]);
        });
    }

    public function recordCashCollection(RideBooking $ride, int $driverId, string $evidence): Payment
    {
        return DB::transaction(function () use ($ride, $driverId, $evidence) {
            $ride = RideBooking::lockForUpdate()->findOrFail($ride->id);
            abort_unless((int) $ride->driver_id === $driverId && $ride->payment_method === 'cash' && $ride->status === 'completed', 422, 'Cash collection is available only for your completed cash ride.');
            $existing = $ride->payments()->where('provider', 'cash')->where('status', Payment::STATUS_CAPTURED)->first();
            if ($existing) {
                return $existing;
            }
            abort_if(in_array($ride->payment_status, ['paid', 'refunded'], true), 422, 'This booking already has a recorded payment.');
            $amount = \App\Support\Money::toMinor($ride->total_fare);
            $payment = Payment::create([
                'provider' => 'cash', 'provider_payment_id' => 'cash_ride_'.$ride->id,
                'payable_type' => RideBooking::class, 'payable_id' => $ride->id,
                'owner_type' => \App\Models\Customer::class, 'owner_id' => $ride->customer_id,
                'amount_minor' => $amount, 'currency' => 'INR', 'method' => 'cash',
                'status' => Payment::STATUS_CAPTURED, 'captured_at' => now(),
                'notes' => ['driver_id' => $driverId, 'evidence' => $evidence],
            ]);
            if ($amount > 0) {
                $ledgerRef = $this->ledger->post('driver:'.$driverId.':cash_collected', 'system:booking_revenue', $amount,
                    ['reference_type' => RideBooking::class, 'reference_id' => (string) $ride->id, 'description' => 'Cash collected: '.$evidence]);
                $payment->update(['notes' => [...$payment->notes, 'ledger_transaction_ref' => $ledgerRef]]);
            }
            $ride->update(['payment_status' => 'paid']);
            $ride->auditLogs()->create(['action' => 'cash.collected', 'after' => ['driver_id' => $driverId, 'payment_id' => $payment->id, 'amount_minor' => $amount], 'note' => $evidence]);

            return $payment;
        });
    }

    public function recordTourCashCollection(TourBooking $booking, int $driverId, int $amountMinor, string $evidence, string $requestId): Payment
    {
        return DB::transaction(function () use ($booking, $driverId, $amountMinor, $evidence, $requestId) {
            $booking = TourBooking::lockForUpdate()->findOrFail($booking->id);
            $key = 'cash_tour_'.hash('sha256', $booking->id.':'.$driverId.':'.$requestId);
            $existing = Payment::where('provider_payment_id', $key)->first();
            if ($existing) {
                abort_unless($existing->amount_minor === $amountMinor && ($existing->notes['evidence'] ?? null) === $evidence, 409, 'Cash receipt key was used for another collection.');

                return $existing;
            }
            $assignment = $booking->driverAssignments()->where('driver_id', $driverId)->where('status', 'accepted')->whereIn('role', ['transport', 'both'])->first();
            abort_unless(in_array($booking->status, ['in_progress', 'completed'], true) && ! $booking->settled_at && $amountMinor > 0, 422, 'Cash can be recorded only for a started, unsettled tour.');
            abort_unless($assignment !== null || (int) $booking->assigned_driver_id === $driverId, 422, 'You must be assigned to this tour to collect cash.');

            $settlementService = app(TourSettlementService::class);
            $remaining = $settlementService->remainingCashMinor($booking);
            abort_if($amountMinor > $remaining, 422, 'Amount exceeds remaining cash to collect.');

            $idempotencyKey = $key;

            $payment = Payment::create([
                'provider' => 'cash', 'provider_payment_id' => $idempotencyKey,
                'payable_type' => TourBooking::class, 'payable_id' => $booking->id,
                'owner_type' => \App\Models\Customer::class, 'owner_id' => $booking->customer_id,
                'amount_minor' => $amountMinor, 'currency' => 'INR', 'method' => 'cash',
                'status' => Payment::STATUS_CAPTURED, 'captured_at' => now(),
                'notes' => ['driver_id' => $driverId, 'evidence' => $evidence],
            ]);

            if ($amountMinor > 0) {
                $ledgerRef = $this->ledger->post('driver:'.$driverId.':cash_collected', 'system:booking_revenue', $amountMinor,
                    ['reference_type' => TourBooking::class, 'reference_id' => (string) $booking->id, 'description' => 'Tour cash collected: '.$evidence]);
                $payment->update(['notes' => [...$payment->notes, 'ledger_transaction_ref' => $ledgerRef]]);
            }

            $booking->auditLogs()->create([
                'action' => 'cash.collected',
                'after' => ['driver_id' => $driverId, 'payment_id' => $payment->id, 'amount_minor' => $amountMinor],
                'note' => $evidence,
            ]);

            if ($booking->payment_plan && app(TourSettlementService::class)->remainingCashMinor($booking) === 0) {
                $booking->update(['payment_status' => 'paid']);
            }
            app(CommissionService::class)->settleTour($booking->fresh());

            return $payment;
        });
    }

    /** Create our record of an intent to collect money. */
    public function createOrder(int $amountMinor, ?Model $payable = null, ?Model $owner = null, array $attributes = []): PaymentOrder
    {
        return PaymentOrder::create([
            'order_number' => $attributes['order_number'] ?? $this->generateNumber('ORD'),
            'provider' => $attributes['provider'] ?? 'razorpay',
            'provider_order_id' => $attributes['provider_order_id'] ?? null,
            'payable_type' => $payable ? $payable::class : null,
            'payable_id' => $payable?->getKey(),
            'owner_type' => $owner ? $owner::class : null,
            'owner_id' => $owner?->getKey(),
            'amount_minor' => $amountMinor,
            'currency' => $attributes['currency'] ?? 'INR',
            'status' => PaymentOrder::STATUS_CREATED,
            'receipt' => $attributes['receipt'] ?? null,
            'notes' => $attributes['notes'] ?? null,
            'idempotency_key' => $attributes['idempotency_key'] ?? null,
        ]);
    }

    /**
     * Record a captured payment. Idempotent on provider_payment_id: a repeat
     * call for an already-captured payment returns the existing row and posts
     * nothing new. For booking payables it posts a gateway → booking-revenue
     * ledger pair and mirrors payment_status='paid' onto the booking.
     */
    public function recordCapturedPayment(array $data): Payment
    {
        $providerPaymentId = $data['provider_payment_id'] ?? null;
        $amountMinor = (int) ($data['amount_minor'] ?? 0);
        $payable = $data['payable'] ?? null;
        $owner = $data['owner'] ?? null;
        $order = $data['order'] ?? null;

        if (! $providerPaymentId || $amountMinor <= 0 || ($data['currency'] ?? 'INR') !== 'INR') {
            throw new \InvalidArgumentException('A capture requires a provider payment ID, positive amount and INR currency.');
        }

        return DB::transaction(function () use ($data, $providerPaymentId, $amountMinor, $payable, $owner, $order) {
            if ($payable) {
                $payable = $payable->newQuery()->lockForUpdate()->findOrFail($payable->getKey());
            }
            if ($payable instanceof TourBooking && $payable->payment_plan) {
                abort_unless(($data['provider'] ?? 'razorpay') === 'razorpay'
                    && $order && $order->provider === 'razorpay'
                    && $order->payable_type === TourBooking::class && (int) $order->payable_id === (int) $payable->id
                    && $order->owner_type === \App\Models\Customer::class && (int) $order->owner_id === (int) $payable->customer_id,
                    422, 'A matching online deposit intent is required.');
            }
            $payment = $providerPaymentId
                ? Payment::where('provider_payment_id', $providerPaymentId)->lockForUpdate()->first()
                : null;

            if ($payment && ($payment->isCaptured() || $payment->captured_at)) {
                return $payment; // idempotent replay
            }

            $payment ??= new Payment;
            $payment->fill([
                'payment_order_id' => $order?->id ?? $payment->payment_order_id,
                'provider' => $data['provider'] ?? 'razorpay',
                'provider_payment_id' => $providerPaymentId,
                'provider_order_id' => $data['provider_order_id'] ?? $order?->provider_order_id,
                'payable_type' => $payable ? $payable::class : $payment->payable_type,
                'payable_id' => $payable?->getKey() ?? $payment->payable_id,
                'owner_type' => $owner ? $owner::class : $payment->owner_type,
                'owner_id' => $owner?->getKey() ?? $payment->owner_id,
                'amount_minor' => $amountMinor,
                'currency' => $data['currency'] ?? 'INR',
                'method' => $data['method'] ?? $payment->method,
                'notes' => $data['notes'] ?? $payment->notes,
            ]);
            $payment->markCaptured();

            $order?->markPaid();

            if ($this->isBooking($payable)) {
                $reason = $this->captureRefundReason($payable, $amountMinor, $order);
                if ($reason !== null) {
                    // Preserve the real capture and its liability even if capacity was released.
                    // A pending refund is intentionally not reported as money returned.
                    $payable->refunds()->create([
                        'customer_id' => $payable->customer_id, 'amount' => \App\Support\Money::toMajor($amountMinor),
                        'cancellation_fee' => 0, 'method' => $data['method'] ?? $payable->payment_method,
                        'status' => 'pending', 'reason' => $reason.' Payment #'.$payment->id,
                    ]);
                    $payable->auditLogs()->create([
                        'action' => 'payment.refund_required', 'note' => $reason,
                        'after' => ['payment_id' => $payment->id, 'amount_minor' => $amountMinor],
                    ]);
                    if ($payable->status === 'cancelled') {
                        $payable->update(['payment_status' => $payable instanceof TourBooking && $payable->payment_plan ? 'partial' : 'paid', 'refund_amount' => (float) $payable->refund_amount + \App\Support\Money::toMajor($amountMinor)]);
                    }
                } else {
                    if ($payable instanceof TourBooking && $payable->payment_plan) {
                        $paid = (int) $payable->online_paid_minor + $amountMinor;
                        $payable->update(['online_paid_minor' => $paid,
                            'payment_status' => $paid >= $payable->payment_plan['total_minor'] ? 'paid' : 'partial']);
                        $this->confirmTourBooking($payable);
                        $payable->refresh();
                        app(BookingLifecycleNotifier::class)->emit($payable, 'booking.confirmed', ['online_paid_minor' => $paid]);
                    } else {
                        $this->mirrorBookingPaid($payable, $data['method'] ?? null);
                        app(BookingLifecycleNotifier::class)->emit($payable, 'payment.paid');
                    }
                }
                if ($payment->provider !== 'wallet') {
                    $this->ledger->post(
                        $payment->provider === 'manual' ? 'system:manual_receipts' : 'system:gateway_clearing',
                        $reason === null ? 'system:booking_revenue' : 'system:refunds_pending',
                        $amountMinor,
                        [
                            'reference_type' => $payable::class,
                            'reference_id' => (string) $payable->getKey(),
                            'description' => 'Gateway capture for '.class_basename($payable).' #'.$payable->getKey(),
                            'currency' => $data['currency'] ?? 'INR',
                        ]
                    );
                }
            }

            return $payment;
        });
    }

    private function captureRefundReason(Model $booking, int $amountMinor, ?PaymentOrder $order): ?string
    {
        if ($booking->status === 'cancelled') {
            return 'Capture received after cancellation.';
        }
        if (in_array($booking->payment_status, ['paid', 'refunded'], true)) {
            return 'Additional capture received for a settled booking.';
        }
        if ($booking instanceof TourBooking && $booking->payment_plan && $booking->online_paid_minor > 0) {
            return 'Additional capture received after the selected online deposit was collected.';
        }
        $expected = $this->bookingPaymentAmount($booking);
        if ($amountMinor !== $expected || ($order && $amountMinor !== (int) $order->amount_minor)) {
            return 'Capture amount does not match the booking payment intent.';
        }
        if ($booking instanceof TourBooking && $booking->status === 'pending') {
            $schedule = $booking->schedule()->lockForUpdate()->first();
            if ($booking->hold_expires_at?->lte(now()) || ! $schedule
                || in_array($schedule->status, ['cancelled', 'completed'], true)
                || (int) $schedule->booked_seats + $booking->getTotalPax() > (int) $schedule->total_seats) {
                app(BookingCancellationService::class)->cancel($booking, 'tour', 'Reservation could not be fulfilled when payment arrived.', null, 'system');
                $booking->refresh();

                return 'Capture received after reservation expiry or loss of capacity.';
            }
        }
        if ($booking instanceof CarRental && in_array($booking->status, ['pending', 'driver_assigned'], true)) {
            if ($booking->hold_expires_at?->lte(now())) {
                app(BookingCancellationService::class)->cancel($booking, 'rental', 'Reservation hold expired before payment arrived.', null, 'system');
                $booking->refresh();

                return 'Capture received after reservation hold expiry.';
            }
        }

        return null;
    }

    /** Record a failed payment attempt; never regresses a captured payment. */
    public function markPaymentFailed(array $data): Payment
    {
        $providerPaymentId = $data['provider_payment_id'] ?? null;
        $order = $data['order'] ?? null;

        return DB::transaction(function () use ($data, $providerPaymentId, $order) {
            $payment = $providerPaymentId
                ? Payment::where('provider_payment_id', $providerPaymentId)->lockForUpdate()->first()
                : null;

            if (! $payment) {
                $payable = $data['payable'] ?? null;
                $owner = $data['owner'] ?? null;
                $payment = new Payment;
                $payment->fill([
                    'payment_order_id' => $order?->id,
                    'provider' => $data['provider'] ?? 'razorpay',
                    'provider_payment_id' => $providerPaymentId,
                    'provider_order_id' => $data['provider_order_id'] ?? $order?->provider_order_id,
                    'payable_type' => $payable ? $payable::class : null,
                    'payable_id' => $payable?->getKey(),
                    'owner_type' => $owner ? $owner::class : null,
                    'owner_id' => $owner?->getKey(),
                    'amount_minor' => (int) ($data['amount_minor'] ?? 0),
                    'currency' => $data['currency'] ?? 'INR',
                    'status' => Payment::STATUS_CREATED,
                ]);
                $payment->save();
            }

            $payment->markFailed($data['error_code'] ?? null, $data['error_description'] ?? null);
            $order?->markFailed();

            return $payment;
        });
    }

    /** Create a payout record for a driver withdrawal. */
    public function createPayout(WithdrawalRequest $withdrawal, int $amountMinor, array $attributes = []): Payout
    {
        return Payout::create([
            'payout_number' => $attributes['payout_number'] ?? $this->generateNumber('PO'),
            'provider' => $attributes['provider'] ?? 'razorpay',
            'withdrawal_request_id' => $withdrawal->id,
            'owner_type' => $withdrawal->owner_type,
            'owner_id' => $withdrawal->owner_id,
            'amount_minor' => $amountMinor,
            'currency' => $attributes['currency'] ?? 'INR',
            'status' => Payout::STATUS_CREATED,
            'fund_account_id' => $attributes['fund_account_id'] ?? null,
            'idempotency_key' => $attributes['idempotency_key'] ?? null,
        ]);
    }

    /** Mark a payout processed and move funds from payout clearing to bank settlement. */
    public function markPayoutProcessed(Payout $payout, ?string $utr = null): Payout
    {
        return DB::transaction(function () use ($payout, $utr) {
            if ($payout->isProcessed()) {
                return $payout; // idempotent
            }

            $payout->markProcessed($utr);

            $this->ledger->post(
                'system:payout_clearing',
                'system:bank_settlement',
                (int) $payout->amount_minor,
                [
                    'reference_type' => 'payout',
                    'reference_id' => (string) $payout->id,
                    'description' => 'Driver payout '.$payout->payout_number,
                    'currency' => $payout->currency,
                ]
            );

            $payout->withdrawalRequest?->markAsCompleted($utr ?? '');

            return $payout;
        });
    }

    public function isBookingCheckoutEnabled(): bool
    {
        return (bool) config('services.razorpay.booking_checkout_enabled', false)
            && filled(config('services.razorpay.key')) && filled(config('services.razorpay.secret'));
    }

    public function bookingPaymentAmount(Model $booking): int
    {
        return $booking instanceof TourBooking && $booking->payment_plan
            ? (int) $booking->payment_plan['selected_minor']
            : Money::toMinor($booking instanceof RideBooking ? $booking->total_fare : $booking->total_price);
    }

    public function isBookingEligibleForPayment(Model $booking): bool
    {
        return ! in_array($booking->status, ['cancelled', 'completed', 'rejected'], true)
            && $booking->payment_status === 'pending'
            && ! ($booking instanceof TourBooking && $booking->hold_expires_at?->lte(now()))
            && ! ($booking instanceof CarRental && $booking->hold_expires_at?->lte(now()))
            && ! ($booking instanceof RideBooking && ! $booking->driver_id && $booking->request_expires_at?->lte(now()));
    }

    public function createOrResumeBookingPaymentOrder(Model $booking, Model $owner): array
    {
        abort_unless($this->isBookingCheckoutEnabled(), 503, 'Online booking checkout is not enabled.');

        [$order, $created] = DB::transaction(function () use ($booking, $owner) {
            $locked = $booking->newQuery()->lockForUpdate()->findOrFail($booking->getKey());
            abort_unless($this->isBookingEligibleForPayment($locked), 409, 'This booking is no longer payable.');
            abort_if($locked->refunds()->where('status', 'pending')->exists(), 409, 'A refund is pending. Do not pay again.');
            $amount = $this->bookingPaymentAmount($locked);
            abort_unless($amount > 0, 422, 'The booking has no payable balance.');
            $existing = $locked->paymentOrders()->where('provider', 'razorpay')->latest('id')->first();
            if ($existing) {
                abort_if(($existing->notes['checkout_state'] ?? null) === 'awaiting_capture' && $existing->status !== PaymentOrder::STATUS_FAILED,
                    409, 'Waiting for provider capture. Do not pay again.');
                abort_unless($existing->amount_minor === $amount && $existing->provider_order_id
                    && in_array($existing->status, [PaymentOrder::STATUS_CREATED, PaymentOrder::STATUS_ATTEMPTED, PaymentOrder::STATUS_FAILED], true),
                    409, 'This payment attempt needs reconciliation before checkout can resume.');

                return [$existing, false];
            }

            return [$this->createOrder($amount, $locked, $owner, [
                'notes' => ['purpose' => 'booking', 'checkout_state' => 'creating'],
            ]), true];
        });

        if ($created) {
            try {
                $provider = app(RazorpayService::class)->createOrder(
                    Money::toMajor($order->amount_minor),
                    $order->order_number,
                    ['purpose' => 'booking', 'payment_order_id' => (string) $order->id]
                );
                if (empty($provider['id']) || ($provider['amount'] ?? null) !== $order->amount_minor || ($provider['currency'] ?? null) !== 'INR') {
                    throw new \RuntimeException('Provider order did not match the payment intent.');
                }
                $order->update([
                    'provider_order_id' => $provider['id'],
                    'receipt' => $order->order_number,
                    'notes' => ['purpose' => 'booking', 'checkout_state' => 'ready'],
                ]);
            } catch (\Throwable $exception) {
                $order->update(['notes' => ['purpose' => 'booking', 'checkout_state' => 'reconciliation_required']]);
                report($exception);

                abort(503, 'Payment order status is uncertain. Please contact support before paying again.');
            }
        }

        abort_unless($this->isBookingEligibleForPayment($booking->fresh()), 409, 'This booking is no longer payable.');

        return [
            'order' => $order,
            'checkout' => [
                'order_id' => $order->provider_order_id,
                'amount_minor' => $order->amount_minor,
                'currency' => $order->currency,
                'key' => config('services.razorpay.key'),
            ],
        ];
    }

    private function isBooking(?Model $payable): bool
    {
        return $payable instanceof RideBooking
            || $payable instanceof TourBooking
            || $payable instanceof CarRental;
    }

    private function mirrorBookingPaid(Model $booking, ?string $method): void
    {
        $attributes = ['payment_status' => 'paid'];
        if ($booking instanceof TourBooking && $booking->status === 'pending') {
            $this->confirmTourBooking($booking);
        }
        if ($booking instanceof CarRental) {
            if ($booking->status === 'pending') {
                $attributes['status'] = $booking->vehicle_id ? 'driver_assigned' : 'confirmed';
            }
            $attributes['hold_expires_at'] = null;
        }
        if ($method) {
            $attributes['payment_method'] = $method;
        }

        $booking->forceFill($attributes)->save();
    }

    public function confirmTourBooking(TourBooking $booking): void
    {
        DB::transaction(function () use ($booking) {
            $booking = TourBooking::lockForUpdate()->findOrFail($booking->id);
            if ($booking->status !== 'pending') {
                return;
            }
            abort_if($booking->payment_plan && (int) $booking->online_paid_minor < (int) $booking->payment_plan['selected_minor'], 422, 'Verified online deposit is required before confirmation.');
            if ($booking->hold_expires_at?->lte(now())) {
                throw \Illuminate\Validation\ValidationException::withMessages(['booking' => 'Tour reservation has expired; captured payment requires refund review.']);
            }
            $schedule = $booking->schedule()->lockForUpdate()->firstOrFail();
            abort_if(in_array($schedule->status, ['cancelled', 'completed'], true), 422, 'This departure is closed.');
            $seats = $booking->getTotalPax();
            if ((int) $schedule->booked_seats + $seats > (int) $schedule->total_seats) {
                throw \Illuminate\Validation\ValidationException::withMessages(['booking' => 'Captured tour payment requires capacity reconciliation.']);
            }
            $schedule->decrement('reserved_seats', min((int) $schedule->reserved_seats, $seats));
            $schedule->increment('booked_seats', $seats);
            $booking->update(['status' => 'confirmed', 'hold_expires_at' => null]);
        });
    }

    private function generateNumber(string $prefix): string
    {
        return $prefix.'_'.strtoupper(Str::random(12));
    }
}

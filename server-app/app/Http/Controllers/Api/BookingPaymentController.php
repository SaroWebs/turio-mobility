<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\PaymentOrder;
use App\Models\RideBooking;
use App\Models\TourBooking;
use App\Services\PaymentService;
use App\Services\RazorpayService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingPaymentController extends Controller
{
    private function booking(Request $request, string $kind, int $id): Model
    {
        abort_unless($request->user() instanceof Customer, 403);
        $model = match ($kind) {
            'ride' => RideBooking::class, 'tour' => TourBooking::class, 'rental' => CarRental::class,
            default => abort(404),
        };

        return $model::where('customer_id', $request->user()->id)->findOrFail($id);
    }

    private function enabled(): bool
    {
        return app(PaymentService::class)->isBookingCheckoutEnabled();
    }

    private function eligible(Model $booking): bool
    {
        return app(PaymentService::class)->isBookingEligibleForPayment($booking);
    }

    public function show(Request $request, string $kind, int $id)
    {
        $booking = $this->booking($request, $kind, $id);
        $webOrigin = rtrim((string) config('services.razorpay.booking_checkout_web_url'), '/');
        $checkoutUrl = str_starts_with($webOrigin, 'https://') ? $webOrigin.'/receipts/'.$id.'?kind='.$kind : null;
        $refundPending = $booking->refunds()->where('status', 'pending')->exists();
        $order = $booking->paymentOrders()->where('provider', 'razorpay')->latest('id')->first();
        $uncertain = $order && (! $order->provider_order_id || ! in_array($order->status,
            [PaymentOrder::STATUS_CREATED, PaymentOrder::STATUS_ATTEMPTED, PaymentOrder::STATUS_FAILED], true));
        $state = match (true) {
            $refundPending => 'refund_pending',
            $booking->payment_status === 'refunded' => 'refunded',
            $booking->payment_status === 'paid' => 'paid',
            $booking instanceof TourBooking && $booking->payment_plan && $booking->payment_status === 'partial' && $booking->status !== 'cancelled' => 'deposit_paid',
            ! $this->eligible($booking) => 'closed',
            (bool) $uncertain => 'reconciliation_required',
            $order && ($order->notes['checkout_state'] ?? null) === 'awaiting_capture' && $order->status !== PaymentOrder::STATUS_FAILED => 'awaiting_capture',
            ! $this->enabled() => 'unavailable',
            $order?->status === PaymentOrder::STATUS_FAILED => 'retryable',
            default => 'ready',
        };
        $message = match ($state) {
            'refund_pending' => 'Refund pending. Do not pay again; contact support for progress.',
            'refunded' => 'Payment refunded.', 'paid' => 'Payment received.',
            'deposit_paid' => 'Online deposit received. Your booking is confirmed; the remaining balance is due in cash at tour start.',
            'closed' => 'This booking is not open for online payment.',
            'reconciliation_required' => 'Payment status needs reconciliation. Do not pay again; contact support.',
            'awaiting_capture' => 'Waiting for provider capture. Do not pay again; payment status will refresh.',
            'unavailable' => 'Online payment is currently unavailable.',
            'retryable' => 'The previous payment attempt failed. You can retry secure checkout.',
            default => 'Online payment is available for this booking.',
        };

        return response()->json(['success' => true, 'data' => [
            'enabled' => $this->enabled(), 'can_pay' => in_array($state, ['ready', 'retryable'], true),
            'checkout_state' => $state, 'status_message' => $message,
            'checkout_url' => $checkoutUrl,
            'payment_status' => $booking->payment_status, 'booking_status' => $booking->status,
            'amount_minor' => app(PaymentService::class)->bookingPaymentAmount($booking),
            'tour_payment' => $booking instanceof TourBooking ? app(\App\Services\TourDepositService::class)->summary($booking) : null,
            'currency' => 'INR', 'refund_pending' => $refundPending,
        ]]);
    }

    public function store(Request $request, string $kind, int $id)
    {
        $booking = $this->booking($request, $kind, $id);
        $result = app(PaymentService::class)->createOrResumeBookingPaymentOrder($booking, $request->user());

        return response()->json(['success' => true, 'data' => $result['checkout']]);
    }

    public function verify(Request $request, string $kind, int $id)
    {
        $booking = $this->booking($request, $kind, $id);
        abort_unless(filled(config('services.razorpay.key')) && filled(config('services.razorpay.secret')), 503, 'Payment verification is temporarily unavailable.');
        // Reconciliation remains available even if new checkout is disabled.
        $data = $request->validate([
            'razorpay_order_id' => ['required', 'string', 'max:100', 'regex:/^order_[A-Za-z0-9]+$/'],
            'razorpay_payment_id' => ['required', 'string', 'max:100', 'regex:/^pay_[A-Za-z0-9]+$/'],
            'razorpay_signature' => ['required', 'string', 'size:64'],
        ]);
        $order = $booking->paymentOrders()->where('provider', 'razorpay')
            ->where('provider_order_id', $data['razorpay_order_id'])->firstOrFail();
        abort_unless($order->owner_type === Customer::class && (int) $order->owner_id === (int) $request->user()->id, 403);
        $gateway = app(RazorpayService::class);
        abort_unless($gateway->verifySignature($order->provider_order_id, $data['razorpay_payment_id'], $data['razorpay_signature']), 422, 'Payment signature is invalid.');
        try {
            $capture = $gateway->fetchPayment($data['razorpay_payment_id']);
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json(['success' => false, 'message' => 'Payment verification is temporarily unavailable. Do not pay again; retry verification.'], 503);
        }
        abort_unless(($capture['id'] ?? null) === $data['razorpay_payment_id']
            && ($capture['order_id'] ?? null) === $order->provider_order_id
            && ($capture['currency'] ?? null) === $order->currency
            && ($capture['amount'] ?? null) === $order->amount_minor, 422, 'Payment details do not match this booking.');
        if (($capture['status'] ?? null) !== 'captured') {
            DB::transaction(function () use ($order, $capture) {
                $locked = PaymentOrder::lockForUpdate()->findOrFail($order->id);
                if ($locked->isPaid()) {
                    return;
                }
                if (($capture['status'] ?? null) === 'failed') {
                    $locked->markFailed();

                    return;
                }
                $locked->markAttempted();
                $locked->update(['notes' => [...($locked->notes ?? []), 'checkout_state' => 'awaiting_capture']]);
            });

            if (($capture['status'] ?? null) === 'failed') {
                return $this->show($request, $kind, $id);
            }

            return response()->json(['success' => true, 'message' => 'Waiting for provider capture.', 'data' => ['payment_status' => 'pending']], 202);
        }
        app(PaymentService::class)->recordCapturedPayment([
            'order' => $order, 'payable' => $booking, 'owner' => $request->user(),
            'provider_payment_id' => $capture['id'], 'provider_order_id' => $order->provider_order_id,
            'amount_minor' => $capture['amount'], 'currency' => $capture['currency'], 'method' => $capture['method'] ?? 'card',
        ]);

        return $this->show($request, $kind, $id);
    }
}

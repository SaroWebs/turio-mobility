<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\RideBooking;
use App\Models\TourBooking;
use App\Services\BookingLifecycleNotifier;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MockPaymentController extends Controller
{
    public function store(Request $request, string $kind, int $id, PaymentService $payments)
    {
        abort_unless(app()->environment('local', 'testing') && config('services.testing.mock_payments'), 404);
        abort_unless($request->user() instanceof Customer, 403);
        $data = $request->validate(['scenario' => 'required|in:success,failed,pending,timeout']);
        $class = match ($kind) {
            'ride' => RideBooking::class, 'tour' => TourBooking::class, 'rental' => CarRental::class, default => abort(404)
        };
        $booking = DB::transaction(function () use ($class, $id, $request, $data, $payments) {
            $booking = $class::where('customer_id', $request->user()->id)->lockForUpdate()->findOrFail($id);
            abort_if(in_array($booking->status, ['cancelled', 'completed']), 409, 'This booking is closed.');
            if ($booking->payment_status === 'paid') {
                return $booking;
            }
            if (in_array($data['scenario'], ['pending', 'timeout'])) {
                return $booking;
            }
            $amount = (int) round((float) ($booking->total_fare ?? $booking->total_price) * 100);
            $payment = ['provider' => 'mock', 'provider_payment_id' => 'mock_'.class_basename($booking).'_'.$id,
                'amount_minor' => $amount, 'payable' => $booking, 'owner' => $request->user(), 'method' => 'upi'];
            if ($data['scenario'] === 'failed') {
                $payments->markPaymentFailed([...$payment, 'error_code' => 'mock_declined', 'error_description' => 'Simulated decline']);

                return $booking->fresh();
            }
            $payments->recordCapturedPayment($payment);
            $booking->refresh();
            if ($booking->status === 'pending') {
                $booking->update(['status' => 'confirmed']);
            }
            app(BookingLifecycleNotifier::class)->emit($booking->fresh(), 'payment.paid');

            return $booking->fresh();
        });

        return response()->json(['success' => $data['scenario'] !== 'timeout', 'simulated' => true,
            'scenario' => $data['scenario'], 'data' => $booking,
            'message' => $data['scenario'] === 'timeout' ? 'Simulated payment timeout; safely retry this payment.' : 'Simulated payment result.'], $data['scenario'] === 'timeout' ? 504 : 200);
    }
}

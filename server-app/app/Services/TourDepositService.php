<?php

namespace App\Services;

use App\Models\TourBooking;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TourDepositService
{
    public function plan(Request $request, int $totalMinor): ?array
    {
        if (! config('tour_deposits.enabled')) {
            return null;
        }
        $type = config('tour_deposits.minimum_type');
        $raw = config('tour_deposits.minimum_value');
        $value = filter_var($raw, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        abort_unless((is_int($raw) || (is_string($raw) && preg_match('/^\d+$/D', $raw)))
            && $value !== false && in_array($type, ['fixed', 'percentage'], true)
            && ($type !== 'percentage' || $value <= 10000) && filled(config('tour_deposits.policy_version')),
            503, 'Tour deposit policy is not configured. Please contact support.');
        abort_unless(app(PaymentService::class)->isBookingCheckoutEnabled(), 503, 'Online tour deposits are currently unavailable.');
        $minimum = $type === 'fixed' ? $value : intdiv($totalMinor * $value + 9999, 10000);
        if ($minimum <= 0 || $minimum > $totalMinor) {
            throw ValidationException::withMessages(['upfront_choice' => 'The configured deposit cannot be applied to this tour total. Contact support.']);
        }
        $choice = $request->input('upfront_choice', 'minimum');
        $selected = match ($choice) {
            'minimum' => $minimum, 'full' => $totalMinor,
            'custom' => (int) $request->input('upfront_amount_minor', 0),
        };
        if ($selected < $minimum || $selected > $totalMinor) {
            throw ValidationException::withMessages(['upfront_amount_minor' => 'Choose an online amount between INR '.number_format($minimum / 100, 2).' and INR '.number_format($totalMinor / 100, 2).'.']);
        }

        return ['policy_version' => (string) config('tour_deposits.policy_version'),
            'minimum_type' => $type, 'minimum_value' => $value, 'total_minor' => $totalMinor,
            'minimum_minor' => $minimum, 'selected_minor' => $selected, 'choice' => $choice,
            'balance_method' => 'cash', 'margin_policy' => $this->marginPolicy()];
    }

    private function marginPolicy(): ?array
    {
        $raw = config('tour_deposits.margin_basis_points');
        if (! is_scalar($raw) || ! preg_match('/^\d+$/D', (string) $raw)
            || (int) $raw > 10000 || ! filled(config('tour_deposits.margin_policy_version'))) {
            return null;
        }

        return ['basis_points' => (int) $raw, 'version' => (string) config('tour_deposits.margin_policy_version')];
    }

    public function summary(TourBooking $booking): ?array
    {
        if (! $booking->payment_plan) {
            return null;
        }
        $plan = $booking->payment_plan;

        return [...$plan, 'online_paid_minor' => (int) $booking->payments()->where('provider', 'razorpay')->whereNotNull('captured_at')->sum('amount_minor'),
            'applied_online_minor' => (int) $booking->online_paid_minor,
            'online_due_minor' => $booking->status === 'cancelled' ? 0 : max(0, $plan['selected_minor'] - (int) $booking->online_paid_minor),
            'remaining_cash_minor' => $booking->status === 'cancelled' ? 0 : max(0, $plan['total_minor'] - max($plan['selected_minor'], (int) $booking->online_paid_minor) - app(TourSettlementService::class)->cashCollectedMinor($booking)),
            'refunded_minor' => \App\Support\Money::toMinor($booking->refunds()->where('status', 'processed')->sum('amount')),
            'refund_pending_minor' => \App\Support\Money::toMinor($booking->refunds()->where('status', 'pending')->sum('amount'))];
    }
}

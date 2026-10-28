<?php

namespace App\Services;

use App\Models\BookingAuditLog;
use App\Models\CarRental;
use App\Models\RideBooking;
use App\Models\TourBooking;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\Config;

class StartVerificationService
{
    public function codeFor(RideBooking|TourBooking|CarRental $booking, string $serviceType): ?string
    {
        if ($booking instanceof RideBooking) {
            return $booking->start_ride_pin;
        }

        $seed = implode('|', [
            $serviceType,
            $booking->id,
            $booking->booking_number,
            $booking->customer_id,
            optional($booking->created_at)->timestamp,
        ]);

        $secret = (string) Config::get('app.key', 'skyslope-local');
        $number = hexdec(substr(hash_hmac('sha256', $seed, $secret), 0, 8)) % 10000;

        return str_pad((string) $number, 4, '0', STR_PAD_LEFT);
    }

    public function isVerified(RideBooking|TourBooking|CarRental $booking): bool
    {
        if ($booking instanceof RideBooking) {
            return (bool) $booking->start_pin_verified_at;
        }

        return BookingAuditLog::query()
            ->where('auditable_type', $booking::class)
            ->where('auditable_id', $booking->id)
            ->whereIn('action', ['customer.checkin.completed', 'operator.start_pin.verified'])
            ->exists();
    }

    public function verifyStartCode(RideBooking|TourBooking|CarRental $booking, string $serviceType, string $code, Authenticatable $operator): BookingAuditLog
    {
        if ((string) $this->codeFor($booking, $serviceType) !== (string) $code) {
            abort(422, 'Invalid 4-digit start OTP. Please verify with the customer.');
        }

        return $this->audit($booking, 'operator.start_pin.verified', [
            'operator_id' => $operator->id,
            'operator_type' => $operator::class,
            'verified_at' => now()->toIso8601String(),
        ], 'Operator verified the customer start OTP.');
    }

    public function checkIn(RideBooking|TourBooking|CarRental $booking, Authenticatable $customer, array $payload = []): BookingAuditLog
    {
        return $this->audit($booking, 'customer.checkin.completed', [
            'customer_id' => $customer->id,
            'checked_in_at' => now()->toIso8601String(),
            'latitude' => $payload['latitude'] ?? null,
            'longitude' => $payload['longitude'] ?? null,
            'note' => $payload['note'] ?? null,
        ], 'Customer confirmed readiness/check-in from customer web.');
    }

    public function audit(Model $booking, string $action, array $after, ?string $note = null): BookingAuditLog
    {
        return BookingAuditLog::create([
            'auditable_type' => $booking::class,
            'auditable_id' => $booking->id,
            'action' => $action,
            'before' => [
                'status' => $booking->getAttribute('status'),
                'payment_status' => $booking->getAttribute('payment_status'),
            ],
            'after' => $after,
            'note' => $note,
        ]);
    }
}

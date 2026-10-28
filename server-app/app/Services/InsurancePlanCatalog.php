<?php

namespace App\Services;

use App\Models\CarRental;
use App\Models\RideBooking;
use App\Models\TourBooking;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class InsurancePlanCatalog
{
    public const TERMS_VERSION = '2026-07-22';

    private const PLANS = [
        'ride_protect' => ['service_type' => 'ride', 'name' => 'Ride Protect', 'policy_type' => 'personal_accident', 'premium' => 49.00, 'coverage_amount' => 100000.00, 'duration_days' => 1],
        'tour_protect' => ['service_type' => 'tour', 'name' => 'Tour Protect', 'policy_type' => 'comprehensive', 'premium' => 249.00, 'coverage_amount' => 300000.00, 'duration_days' => 30],
        'rental_protect' => ['service_type' => 'rental', 'name' => 'Rental Protect', 'policy_type' => 'comprehensive', 'premium' => 399.00, 'coverage_amount' => 500000.00, 'duration_days' => 30],
    ];

    public function publicPlans(): array
    {
        return collect(self::PLANS)->map(fn (array $plan, string $code) => [
            'code' => $code,
            ...$plan,
            'terms_version' => self::TERMS_VERSION,
            'provider_name' => config('services.insurance.provider_name'),
            'provider_policy_url' => config('services.insurance.provider_policy_url'),
            'available' => $this->isConfigured(),
        ])->values()->all();
    }

    public function isConfigured(): bool
    {
        return filled(config('services.insurance.provider_name'))
            && filled(config('services.insurance.provider_policy_url'));
    }

    public function plan(string $code): array
    {
        if (! isset(self::PLANS[$code])) {
            throw ValidationException::withMessages(['plan_code' => 'The selected insurance plan is unavailable.']);
        }

        return ['code' => $code, ...self::PLANS[$code]];
    }

    public function customerBooking(string $serviceType, int $bookingId, int $customerId): Model
    {
        $model = match ($serviceType) {
            'ride' => RideBooking::class,
            'tour' => TourBooking::class,
            'rental' => CarRental::class,
            default => throw ValidationException::withMessages(['service_type' => 'Unsupported insured service type.']),
        };

        return $model::query()
            ->whereKey($bookingId)
            ->where('customer_id', $customerId)
            ->firstOr(fn () => throw ValidationException::withMessages(['booking_id' => 'The booking was not found for this customer.']));
    }
}

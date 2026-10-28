<?php

namespace App\Services;

use App\Models\CarRental;
use App\Models\Driver;
use App\Models\RideBooking;
use App\Models\TourBooking;
use App\Models\Wallet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

class CommissionService
{
    public function calculateCommission(Model $booking): float
    {
        return match (true) {
            $booking instanceof RideBooking => $this->calculateRideCommission($booking),
            $booking instanceof CarRental => $this->calculateRentalCommission($booking),
            $booking instanceof TourBooking => $this->calculateTourCommission($booking),
            default => 0.0,
        };
    }

    public function calculateRideCommission(RideBooking $booking): float
    {
        $baseRate = match ($booking->service_type) {
            'hourly' => (float) setting('commission.ride.hourly', 0.03),
            'round_trip' => (float) setting('commission.ride.round_trip', 0.025),
            default => (float) setting('commission.ride.default', 0.025),
        };

        return round(((float) $booking->total_fare) * $baseRate * (float) ($booking->surge_multiplier ?? 1), 2);
    }

    public function calculateRentalCommission(CarRental $rental): float
    {
        return round(((float) $rental->total_price) * (float) setting('commission.rental', 0.20, [
            'category_id' => $rental->car_category_id,
        ]), 2);
    }

    public function calculateTourCommission(TourBooking $booking): float
    {
        return round(((float) $booking->total_price) * (float) setting('commission.tour', 0.15), 2);
    }

    public function settleBooking(Model $booking): bool
    {
        return match (true) {
            $booking instanceof RideBooking => $this->settleRide($booking),
            $booking instanceof CarRental => $this->settleRental($booking),
            $booking instanceof TourBooking => $this->settleTour($booking),
            default => false,
        };
    }

    public function settleRide(RideBooking $booking): bool
    {
        return $this->settleDriverEarnings(
            $booking,
            $booking->driver_id,
            (float) $booking->total_fare,
            $this->calculateRideCommission($booking),
            "ride_booking:{$booking->id}"
        );
    }

    public function settleRental(CarRental $rental): bool
    {
        return $this->settleDriverEarnings(
            $rental,
            $rental->driver_id,
            (float) $rental->total_price,
            $this->calculateRentalCommission($rental),
            "car_rental:{$rental->id}"
        );
    }

    public function settleTour(TourBooking $booking): bool
    {
        // Deposit/cash-aware settlement requires its own policy and ledger flow (G-60).
        if ($booking->payment_plan) {
            return app(TourSettlementService::class)->settle($booking);
        }

        return $this->settleDriverEarnings(
            $booking,
            $booking->assigned_driver_id,
            (float) $booking->total_price,
            $this->calculateTourCommission($booking),
            "tour_booking:{$booking->id}"
        );
    }

    public function processPayment(RideBooking $booking): bool
    {
        return $this->settleRide($booking);
    }

    public function getDriverCommissionStats(int $driverId, ?string $startDate = null, ?string $endDate = null): array
    {
        $query = RideBooking::query()
            ->where('driver_id', $driverId)
            ->where('status', 'completed')
            ->where('driver_share', '>', 0);

        if ($startDate) {
            $query->whereDate('completed_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->whereDate('completed_at', '<=', $endDate);
        }

        $totalEarnings = (float) $query->sum('driver_share');
        $earningCount = $query->count();

        return [
            'total_earnings' => $totalEarnings,
            'earning_count' => $earningCount,
            'average_earning' => $earningCount > 0 ? round($totalEarnings / $earningCount, 2) : 0,
        ];
    }

    public function getPlatformCommissionStats(?string $startDate = null, ?string $endDate = null): array
    {
        $rideQuery = RideBooking::where('status', 'completed');
        $rentalQuery = CarRental::where('status', 'completed');
        $tourQuery = TourBooking::where('status', 'completed');

        foreach ([$rideQuery, $rentalQuery, $tourQuery] as $query) {
            if ($startDate) {
                $query->whereDate('updated_at', '>=', $startDate);
            }
            if ($endDate) {
                $query->whereDate('updated_at', '<=', $endDate);
            }
        }

        return [
            'total_commission' => (float) $rideQuery->sum('commission_amount')
                + (float) $rentalQuery->sum('commission_amount')
                + (float) $tourQuery->sum('commission_amount'),
            'completed_rides' => $rideQuery->count(),
            'completed_rentals' => $rentalQuery->count(),
            'completed_tours' => $tourQuery->count(),
        ];
    }

    public function processDriverWithdrawal(int $driverId, float $amount, string $description = ''): bool
    {
        try {
            $driver = Driver::find($driverId);
            $driverWallet = $driver ? Wallet::forOwner($driver)->first() : null;

            if (! $driverWallet) {
                throw new \RuntimeException('Driver wallet not found');
            }

            $driverWallet->debit(
                $amount,
                $description ?: 'Driver withdrawal',
                'driver_withdrawal',
                (string) $driverId
            );

            return true;
        } catch (\Throwable $exception) {
            Log::error('Driver withdrawal failed: '.$exception->getMessage(), [
                'driver_id' => $driverId,
                'amount' => $amount,
            ]);

            return false;
        }
    }

    private function settleDriverEarnings(
        Model $booking,
        ?int $driverId,
        float $grossAmount,
        float $commission,
        string $referenceId
    ): bool {
        if (! $driverId || $grossAmount <= 0 || $booking->status !== 'completed' || $booking->payment_status !== 'paid') {
            return false;
        }

        $driver = Driver::find($driverId);
        if (! $driver) {
            return false;
        }

        $driverShare = max(0, round($grossAmount - $commission, 2));
        $wallet = Wallet::firstOrCreate([
            'owner_type' => Driver::class,
            'owner_id' => $driver->id,
        ], [
            'balance' => 0,
            'currency' => 'INR',
            'is_active' => true,
        ]);

        if (($booking->payment_method ?? null) === 'cash') {
            if ($commission > 0) {
                $wallet->debit(
                    $commission,
                    'System charge deduction for cash ride',
                    'system_charge',
                    $referenceId,
                    "system_charge:{$referenceId}"
                );
            }
        } elseif ($driverShare > 0) {
            $wallet->credit(
                $driverShare,
                'Driver earning settlement',
                'driver_earning',
                $referenceId,
                "driver_earning:{$referenceId}"
            );
        }

        $booking->forceFill([
            'commission_amount' => $commission,
            'driver_share' => $driverShare,
        ])->save();

        return true;
    }
}

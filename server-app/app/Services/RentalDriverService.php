<?php

namespace App\Services;

use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RentalDriverService
{
    public function assertReady(CarRental $rental): void
    {
        $driver = Driver::find($rental->driver_id);
        $vehicle = Vehicle::find($rental->vehicle_id);
        if (! $driver || ! $vehicle || ! $driver->isApproved() || ! $driver->is_active || $driver->status !== 'active'
            || ! $driver->canHandleService('rental') || ! $vehicle->isApprovedForService()
            || ! app(DriverEligibilityService::class)->evaluate($driver, 'rental', $vehicle)['eligible']
            || (int) $vehicle->driver_id !== (int) $driver->id) {
            throw ValidationException::withMessages(['driver_id' => 'A verified driver and an approved car must be assigned before the trip starts.']);
        }
    }

    /** Called while holding the driver and vehicle locks in the booking transaction. */
    public function assertAvailable(Vehicle $vehicle, string $start, string $end): void
    {
        $driver = Driver::find($vehicle->driver_id);
        if (! $driver || ! $driver->isApproved() || ! $driver->is_active || $driver->status !== 'active'
            || ! $driver->canHandleService('rental') || ! $vehicle->isApprovedForService()
            || ! app(DriverEligibilityService::class)->evaluate($driver, 'rental', $vehicle)['eligible']) {
            throw new \RuntimeException('This car and driver are no longer available. Please choose another car.');
        }
        $conflicts = app(ResourceCommitmentService::class)->findConflicts(
            $driver->id,
            $vehicle->id,
            $start,
            $end
        );

        if (! empty($conflicts)) {
            throw new \RuntimeException('This car or driver is already booked for the selected dates.');
        }
    }

    /**
     * Compute total rentable vehicles and available conflict-free vehicles for a category across a date range.
     *
     * @return array{category_id: int, total_vehicles: int, available_vehicles: int, is_available: bool}
     */
    public function getCategoryAvailability(CarCategory $category, string $start, string $end): array
    {
        $vehicles = Vehicle::query()
            ->with('driver')
            ->where('car_category_id', $category->id)
            ->where('is_available_for_rent', true)
            ->where('is_active', true)
            ->where('approval_status', 'approved')
            ->where(fn ($q) => $q->whereNull('condition')->orWhere('condition', '!=', 'under_maintenance'))
            ->whereHas('driver', fn ($q) => $q->where('status', 'active')->where('is_active', true)->where('is_approved', true)->where('can_rental_delivery', true))
            ->get();

        $totalCount = $vehicles->count();
        $availableCount = 0;

        foreach ($vehicles as $vehicle) {
            try {
                $this->assertAvailable($vehicle, $start, $end);
                $availableCount++;
            } catch (\Throwable) {
                // Not available or committed
            }
        }

        return [
            'category_id' => $category->id,
            'total_vehicles' => $totalCount,
            'available_vehicles' => $availableCount,
            'is_available' => $availableCount > 0,
        ];
    }

    /**
     * Return eligible, conflict-free drivers & vehicles for a rental booking, ranked by proximity and rating.
     */
    public function getRankedCandidates(CarRental $rental): array
    {
        $vehiclesQuery = Vehicle::query()
            ->with(['driver.latestLocation', 'category'])
            ->when($rental->car_category_id, fn ($q) => $q->where('car_category_id', $rental->car_category_id))
            ->where('is_available_for_rent', true)
            ->where('is_active', true)
            ->where('approval_status', 'approved')
            ->where(fn ($q) => $q->whereNull('condition')->orWhere('condition', '!=', 'under_maintenance'))
            ->whereHas('driver', fn ($q) => $q->where('status', 'active')->where('is_active', true)->where('is_approved', true)->where('can_rental_delivery', true));

        $pickupLat = $rental->pickup_lat !== null ? (float) $rental->pickup_lat : null;
        $pickupLng = $rental->pickup_lng !== null ? (float) $rental->pickup_lng : null;
        $candidates = [];

        foreach ($vehiclesQuery->get() as $vehicle) {
            $driver = $vehicle->driver;
            if (! $driver) {
                continue;
            }

            $eligibilityFailures = app(DriverDispatchService::class)->eligibilityFailures(
                $driver,
                'rental',
                null,
                $rental->car_category_id ? (int) $rental->car_category_id : null,
                $vehicle->id,
                $pickupLat,
                $pickupLng,
                null,
                null,
                null,
                $rental->id
            );

            if (! empty($eligibilityFailures)) {
                continue;
            }

            $conflicts = app(ResourceCommitmentService::class)->findConflicts(
                $driver->id,
                $vehicle->id,
                $rental->start_date->toDateString(),
                $rental->end_date->toDateString(),
                ['exclude_car_rental_id' => $rental->id]
            );

            if (! empty($conflicts)) {
                continue;
            }

            $distanceKm = null;
            $driverLocation = $driver->latestLocation;
            if ($pickupLat !== null && $pickupLng !== null && $driverLocation && $driverLocation->latitude && $driverLocation->longitude) {
                $distanceKm = round(app(DriverDispatchService::class)->haversineDistance(
                    $pickupLat,
                    $pickupLng,
                    (float) $driverLocation->latitude,
                    (float) $driverLocation->longitude
                ), 2);
            }

            $candidates[] = [
                'driver' => [
                    'id' => $driver->id,
                    'name' => $driver->name,
                    'phone' => $driver->phone,
                    'rating' => (float) ($driver->rating ?? 5.0),
                    'status' => $driver->status,
                ],
                'vehicle' => [
                    'id' => $vehicle->id,
                    'registration_number' => $vehicle->registration_number,
                    'make' => $vehicle->make,
                    'model' => $vehicle->model,
                    'year' => $vehicle->year,
                    'color' => $vehicle->color,
                    'seats' => $vehicle->seats,
                ],
                'distance_km' => $distanceKm,
                'is_assigned' => (int) $rental->driver_id === (int) $driver->id && (int) $rental->vehicle_id === (int) $vehicle->id,
            ];
        }

        usort($candidates, function ($a, $b) {
            if ($a['distance_km'] !== null && $b['distance_km'] !== null) {
                $cmp = $a['distance_km'] <=> $b['distance_km'];
                if ($cmp !== 0) {
                    return $cmp;
                }
            } elseif ($a['distance_km'] !== null) {
                return -1;
            } elseif ($b['distance_km'] !== null) {
                return 1;
            }

            return $b['driver']['rating'] <=> $a['driver']['rating'];
        });

        return $candidates;
    }

    /**
     * Atomically assign a verified driver and vehicle to a rental booking.
     */
    public function assignDriver(CarRental $rental, Driver $driver, ?int $vehicleId = null, ?int $adminId = null): CarRental
    {
        $vehicleId = $vehicleId ?: ($rental->vehicle_id ?: $driver->vehicle?->id);
        if (! $vehicleId) {
            throw ValidationException::withMessages(['vehicle_id' => 'A valid vehicle must be specified or associated with the driver.']);
        }

        return DB::transaction(function () use ($rental, $driver, $vehicleId, $adminId) {
            app(ResourceCommitmentService::class)->lockResources($driver->id, $vehicleId);
            $locked = CarRental::lockForUpdate()->findOrFail($rental->id);

            $eligibilityFailures = app(DriverDispatchService::class)->eligibilityFailures(
                $driver,
                'rental',
                null,
                $locked->car_category_id ? (int) $locked->car_category_id : null,
                $vehicleId,
                $locked->pickup_lat !== null ? (float) $locked->pickup_lat : null,
                $locked->pickup_lng !== null ? (float) $locked->pickup_lng : null,
                null,
                null,
                null,
                $locked->id
            );

            if (! empty($eligibilityFailures)) {
                throw ValidationException::withMessages(['driver_id' => implode(' ', $eligibilityFailures)]);
            }

            $conflicts = app(ResourceCommitmentService::class)->findConflicts(
                $driver->id,
                $vehicleId,
                $locked->start_date->toDateString(),
                $locked->end_date->toDateString(),
                ['exclude_car_rental_id' => $locked->id]
            );

            if (! empty($conflicts)) {
                throw ValidationException::withMessages(['driver_id' => implode(' ', $conflicts)]);
            }

            $previousDriverId = $locked->driver_id;

            $locked->update([
                'driver_id' => $driver->id,
                'vehicle_id' => $vehicleId,
                'status' => in_array($locked->status, ['completed', 'cancelled'], true)
                    ? $locked->status
                    : 'driver_assigned',
            ]);

            if ($previousDriverId && (int) $previousDriverId !== (int) $driver->id) {
                $prevDriver = Driver::find($previousDriverId);
                if ($prevDriver && ! app(DriverDispatchService::class)->hasActiveWorkload($prevDriver)) {
                    DriverAvailability::where('driver_id', $previousDriverId)->update([
                        'status' => 'online',
                        'is_available' => true,
                        'last_updated' => now(),
                    ]);
                }
            }

            // Notify Customer
            app(BookingLifecycleNotifier::class)->emit($locked->fresh('customer'), 'driver.assigned', [
                'driver_id' => $driver->id,
                'vehicle_id' => $vehicleId,
            ]);

            // Notify Driver (G-41 requirement)
            app(BookingLifecycleNotifier::class)->emit($driver, 'rental.driver_assigned', [
                'rental_id' => $locked->id,
                'booking_number' => $locked->booking_number,
                'pickup_location' => $locked->pickup_location,
                'start_date' => $locked->start_date->toDateString(),
                'end_date' => $locked->end_date->toDateString(),
            ]);

            $locked->auditLogs()->create([
                'action' => 'driver.assigned',
                'note' => 'Driver #'.$driver->id.' assigned to car rental #'.$locked->id,
                'after' => ['driver_id' => $driver->id, 'vehicle_id' => $vehicleId, 'admin_id' => $adminId],
            ]);

            return $locked->fresh(['driver:id,name,email,phone', 'vehicle']);
        });
    }
}

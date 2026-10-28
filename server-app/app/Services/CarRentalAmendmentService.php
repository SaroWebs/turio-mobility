<?php

namespace App\Services;

use App\Models\BookingAuditLog;
use App\Models\BookingRefund;
use App\Models\CarRental;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class CarRentalAmendmentService
{
    protected ResourceCommitmentService $commitmentService;

    public function __construct(ResourceCommitmentService $commitmentService)
    {
        $this->commitmentService = $commitmentService;
    }

    /**
     * Preview a rental modification without applying it.
     */
    public function preview(CarRental $rental, array $params): array
    {
        $startDate = Carbon::parse($rental->start_date)->startOfDay();
        $currentEndDate = Carbon::parse($rental->end_date)->startOfDay();
        $newEndDate = Carbon::parse($params['end_date'])->startOfDay();
        $newEndTime = $params['end_time'] ?? $rental->end_time;

        $additionalDays = (int) round(($newEndDate->timestamp - $currentEndDate->timestamp) / 86400);

        $snapshot = $rental->pricing_snapshot;
        abort_unless(isset($snapshot['base_price_per_day']) && is_numeric($snapshot['base_price_per_day']) && $snapshot['base_price_per_day'] > 0, 422, 'A verified daily pricing snapshot is required.');
        $dailyRate = (float) $snapshot['base_price_per_day'];
        abort_if($newEndDate->lt($startDate) || ($rental->number_of_days + $additionalDays) < 1, 422, 'Rental must retain at least one day.');
        // Complex quotes require a dedicated repricing flow, not a guessed adjustment.
        foreach (['discount_amount', 'tax_amount', 'service_fee_amount', 'distance_price', 'extras_price'] as $field) {
            abort_if((float) $rental->$field != 0, 422, 'This rental requires a revised itemized quote.');
        }
        $priceDelta = $dailyRate * $additionalDays;

        $proposed = clone $rental;
        $proposed->end_date = $newEndDate;
        $proposed->end_time = $newEndTime;
        $interval = $this->commitmentService->getRentalInterval($proposed);
        abort_unless($interval['end']->gt($interval['start']), 422, 'Invalid rental interval.');

        // Check availability
        $conflicts = [];
        if ($rental->vehicle_id || $rental->driver_id) {
            $conflicts = $this->commitmentService->findConflicts(
                $rental->driver_id,
                $rental->vehicle_id,
                $interval['start'],
                $interval['end'],
                ['exclude_car_rental_id' => $rental->id, 'exact_interval' => true]
            );
        }

        return [
            'version' => hash('sha256', json_encode([$rental->end_date?->toDateString(), $rental->end_time, $rental->total_price, $rental->driver_id, $rental->vehicle_id, $rental->auditLogs()->where('action', 'amended')->count()])),
            'available' => empty($conflicts),
            'conflicts' => $conflicts,
            'price_delta' => $priceDelta,
            'additional_days' => $additionalDays,
            'new_end_date' => $newEndDate->format('Y-m-d'),
        ];
    }

    /**
     * Apply a rental amendment (date extension/reduction).
     */
    public function amend(CarRental $rental, array $params, int $adminId, string $requestId): CarRental
    {
        return DB::transaction(function () use ($rental, $params, $adminId, $requestId) {
            $this->commitmentService->lockResources($rental->driver_id, $rental->vehicle_id);
            $resources = [$rental->driver_id, $rental->vehicle_id];
            // Lock rental
            $rental = CarRental::where('id', $rental->id)->lockForUpdate()->firstOrFail();
            abort_if($resources !== [$rental->driver_id, $rental->vehicle_id], 409, 'Assignment changed. Refresh the amendment.');

            if (in_array($rental->status, ['completed', 'cancelled', 'refunded'])) {
                throw new \Exception("Cannot amend a {$rental->status} rental.");
            }

            // Check idempotency via audit log
            $existing = BookingAuditLog::where('auditable_id', $rental->id)
                ->where('auditable_type', CarRental::class)
                ->where('action', 'amended')
                ->where('after->request_id', $requestId)
                ->first();

            $fingerprint = hash('sha256', json_encode($params));
            if ($existing) {
                abort_unless(($existing->after['fingerprint'] ?? null) === $fingerprint, 409, 'Amendment key was used for another change.');

                return $rental;
            }

            $preview = $this->preview($rental, $params);

            abort_if(isset($params['version']) && ! hash_equals($preview['version'], $params['version']), 409, 'Rental changed after preview.');
            if (! $preview['available']) {
                throw new \Exception('Conflicting bookings found for driver or vehicle.');
            }

            $beforeState = $rental->toArray();

            $rental->end_date = $preview['new_end_date'];
            if (isset($params['end_time'])) {
                $rental->end_time = $params['end_time'];
            }
            $rental->number_of_days += $preview['additional_days'];
            $rental->total_price += $preview['price_delta'];

            $received = (int) $rental->payments()->whereNotNull('captured_at')->sum('amount_minor');
            $refunded = \App\Support\Money::toMinor($rental->refunds()->whereIn('status', ['pending', 'processed'])->sum('amount'));
            $newTotalMinor = \App\Support\Money::toMinor($rental->total_price);
            abort_if($received > 0 && $received - $refunded < $newTotalMinor, 422, 'A funded rental extension requires a separate balance-payment amendment.');
            $rental->payment_status = max(0, $received - $refunded) >= $newTotalMinor ? 'paid' : 'pending';
            $rental->base_price += $preview['price_delta'];
            $rental->save();

            if ($preview['price_delta'] < 0 && $received - $refunded > $newTotalMinor) {
                // Refund
                BookingRefund::create([
                    'refundable_type' => CarRental::class,
                    'refundable_id' => $rental->id,
                    'customer_id' => $rental->customer_id,
                    'amount' => min(abs($preview['price_delta']), ($received - $refunded - $newTotalMinor) / 100),
                    'reason' => 'Rental reduced',
                    'status' => 'pending',
                ]);
            }

            BookingAuditLog::create([
                'auditable_type' => CarRental::class,
                'auditable_id' => $rental->id,
                'admin_id' => $adminId,
                'action' => 'amended',
                'before' => $beforeState,
                'after' => ['request_id' => $requestId, 'fingerprint' => $fingerprint, 'booking' => $rental->toArray()],
            ]);

            return $rental;
        });
    }
}

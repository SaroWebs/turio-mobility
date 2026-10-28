<?php

namespace App\Services;

use App\Models\RideBooking;
use Illuminate\Support\Facades\DB;

class RideRequestLifecycle
{
    public const SEARCH_SECONDS = 600;

    public function expireStaleAssignedRides(): int
    {
        $count = 0;
        $cutoff = now()->subSeconds(max(60, (int) setting('ride.lifecycle.stale_assigned_seconds', 7200)));
        RideBooking::whereNotNull('driver_id')->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup'])
            ->whereRaw('COALESCE(driver_assigned_at, created_at) <= ?', [$cutoff])
            ->chunkById(100, function ($rides) use (&$count, $cutoff) {
                foreach ($rides as $ride) {
                    $count += DB::transaction(function () use ($ride, $cutoff) {
                        \App\Models\Driver::whereKey($ride->driver_id)->lockForUpdate()->first();
                        $ride = RideBooking::lockForUpdate()->find($ride->id);
                        if (! $ride || ! in_array($ride->status, ['driver_assigned', 'driver_arriving', 'pickup'], true)
                            || ($ride->driver_assigned_at ?? $ride->created_at)->gt($cutoff)) {
                            return 0;
                        }
                        app(BookingCancellationService::class)->cancel($ride, 'ride', 'Pickup timed out before the trip started.', null, 'system');

                        return 1;
                    });
                }
            });
        RideBooking::where('status', 'in_transit')
            ->whereRaw('COALESCE(started_at, created_at) <= ?', [now()->subSeconds(max(60, (int) setting('ride.lifecycle.stale_in_transit_seconds', 86400)))])
            ->chunkById(100, function ($rides) {
                foreach ($rides as $ride) {
                    DB::transaction(function () use ($ride) {
                        $ride = RideBooking::lockForUpdate()->find($ride->id);
                        if (! $ride || $ride->status !== 'in_transit' || $ride->auditLogs()->where('action', 'ride.stale_review')->exists()) {
                            return;
                        }
                        $ride->update(['admin_assignable' => true]);
                        $ride->auditLogs()->create(['action' => 'ride.stale_review', 'note' => 'In-transit ride exceeded the review threshold. Verify passenger safety before closing.']);
                    });
                }
            });

        return $count;
    }

    public function expire(): int
    {
        $count = 0;
        RideBooking::whereNull('driver_id')->whereIn('status', ['pending', 'confirmed'])
            ->whereNotNull('request_expires_at')->where('request_expires_at', '<=', now())
            ->chunkById(100, function ($rows) use (&$count) {
                foreach ($rows as $row) {
                    $count += DB::transaction(function () use ($row) {
                        $ride = RideBooking::lockForUpdate()->find($row->id);
                        if (! $ride || $ride->driver_id || ! in_array($ride->status, ['pending', 'confirmed']) || ! $ride->request_expires_at?->lte(now())) {
                            return 0;
                        }
                        $this->close($ride, 'expired');

                        return 1;
                    });
                }
            });

        return $count;
    }

    public function close(RideBooking $ride, string $outcome): void
    {
        if ($ride->payment_status === 'paid') {
            app(BookingCancellationService::class)->cancel($ride, 'ride',
                $outcome === 'expired' ? 'No driver accepted before the request expired.' : 'Replaced by a new customer request.', null, 'system');
            $ride->refresh()->update(['request_outcome' => $outcome, 'request_closed_at' => now()]);

            return;
        }
        // Keep legacy booking enums/contracts compatible; request_outcome is explicit.
        $ride->update(['status' => 'cancelled', 'request_outcome' => $outcome,
            'request_closed_at' => now(), 'cancelled_at' => now(),
            'cancellation_reason' => $outcome === 'expired' ? 'No driver accepted before the request expired.' : 'Replaced by a new customer request.',
            'admin_assignable' => false]);
        $ride->dispatchAttempts()->where('status', 'offered')->update(['status' => 'expired']);
        app(BookingLifecycleNotifier::class)->emit($ride, 'booking.cancelled', ['outcome' => $outcome]);
        DB::afterCommit(fn () => broadcast(new \App\Events\RideStatusUpdated($ride, 'cancelled', $ride->cancellation_reason, 'pending')));
    }

    public function purge(bool $dryRun = true): array
    {
        $result = ['eligible' => 0, 'deleted' => 0, 'protected' => 0];
        RideBooking::whereIn('request_outcome', ['expired', 'superseded'])
            ->where('request_closed_at', '<=', now()->subDays((int) setting('ride.retention.days', 30)))
            ->chunkById(100, function ($rows) use (&$result, $dryRun) {
                foreach ($rows as $row) {
                    DB::transaction(function () use ($row, &$result, $dryRun) {
                        $ride = RideBooking::lockForUpdate()->find($row->id);
                        if (! $ride || ! $this->deletable($ride)) {
                            $result['protected']++;

                            return;
                        }
                        $result['eligible']++;
                        if ($dryRun) {
                            return;
                        }
                        $dimensions = ['day' => $ride->created_at->toDateString(), 'service_type' => $ride->service_type, 'outcome' => $ride->request_outcome];
                        DB::table('ride_demand_daily')->insertOrIgnore([...$dimensions, 'requests' => 0]);
                        DB::table('ride_demand_daily')->where($dimensions)->increment('requests');
                        $ride->auditLogs()->delete();
                        $ride->couponRedemptions()->delete();
                        DB::table('driver_locations')->where('context', 'ride:'.$ride->id)->delete();
                        DB::table('outbox_messages')->where('dedup_key', 'like', 'booking:ride:'.$ride->id.':%')->delete();
                        \App\Models\IdempotencyKey::where('path', 'api/customer-app/rides')->where('status', 'completed')->each(function ($key) use ($ride) {
                            if ((int) data_get(json_decode($key->response_body, true), 'data.id') === $ride->id) {
                                $key->delete();
                            }
                        });
                        $ride->delete(); // offers/reviews/tips have explicit cascading foreign keys
                        $result['deleted']++;
                    });
                }
            });

        return $result;
    }

    private function deletable(RideBooking $ride): bool
    {
        if ($ride->driver_id || $ride->vehicle_id || $ride->started_at || $ride->driver_assigned_at || $ride->completed_at
            || $ride->refunded_at || (float) $ride->refund_amount > 0 || $ride->status !== 'cancelled'
            || ! in_array($ride->payment_status, ['pending', 'failed'], true)) {
            return false;
        }
        foreach (['payments', 'paymentOrders', 'refunds', 'incidents', 'tips', 'reviews'] as $relation) {
            if ($ride->$relation()->exists()) {
                return false;
            }
        }
        if ($ride->dispatchAttempts()->where('status', 'accepted')->exists()) {
            return false;
        }
        foreach (['wallet_transactions', 'ledger_entries'] as $table) {
            if (DB::table($table)->whereIn('reference_type', ['ride_booking', RideBooking::class])->where('reference_id', $ride->id)->exists()) {
                return false;
            }
        }
        // Support references are structured; retain any request mentioned in a ticket.
        if (DB::table('support_tickets')->whereIn('booking_type', ['ride', RideBooking::class])->where('booking_id', $ride->id)->exists()) {
            return false;
        }

        return true;
    }
}

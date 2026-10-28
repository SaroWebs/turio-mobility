<?php

namespace App\Services;

use App\Models\BookingAuditLog;
use App\Models\CarpoolBooking;
use App\Models\CarpoolPolicy;
use App\Models\CarpoolRide;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\Vehicle;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class CarpoolService
{
    public function key(Model $actor): string
    {
        return $actor::class.':'.$actor->id;
    }

    public function actor(Model $actor): void
    {
        abort_unless(($actor instanceof Customer || $actor instanceof Driver) && $actor->is_active && $actor->phone_verified_at, 403, 'An active, phone-verified account is required.');
    }

    public function driver(Model $actor): Driver
    {
        $this->actor($actor);
        $actor = $this->linkedDriver($actor);
        abort_unless($actor instanceof Driver && $actor->is_approved && $actor->can_long_ride
            && $actor->license_expiry && $actor->license_expiry->gte(today()), 403, 'Complete driver verification and intercity eligibility first.');
        abort_unless(app(DriverVerificationService::class)->summary($actor)['is_complete'], 403, 'Required driver documents must be approved and current.');
        abort_unless(app(DriverEligibilityService::class)->evaluate($actor, 'carpool', $actor->vehicle)['eligible'], 403, 'Carpool compliance review is required.');

        return $actor;
    }

    public function linkedDriver(Model $actor): ?Driver
    {
        if (! $actor->is_active || ! $actor->phone_verified_at) {
            return null;
        }
        if ($actor instanceof Driver) {
            return $actor;
        }

        // Both records must prove possession of the same phone. Never link by an unverified email/name.
        return $actor instanceof Customer && $actor->phone_verified_at
            ? Driver::where('phone', $actor->phone)->whereNotNull('phone_verified_at')->first() : null;
    }

    public function save(Model $actor, array $data, ?int $id = null): CarpoolRide
    {
        $driver = $this->driver($actor);

        return DB::transaction(function () use ($driver, $data, $id) {
            $resources = app(ResourceCommitmentService::class);
            $resources->lockResources($driver->id, $data['vehicle_id']);
            $driver = $this->driver($driver->fresh());
            $vehicle = Vehicle::findOrFail($data['vehicle_id']);
            abort_unless($vehicle->driver_id === $driver->id && $vehicle->isApprovedForService(), 422, 'Choose your approved, roadworthy vehicle.');
            abort_if($data['seats'] > $vehicle->seats - 1, 422, 'Passenger seats must exclude the driver.');
            $ride = $id ? CarpoolRide::lockForUpdate()->findOrFail($id) : new CarpoolRide;
            if ($id) {
                abort_unless($ride->driver_id === $driver->id, 403);
                abort_unless(in_array($ride->status, ['draft', 'published']), 409, 'This trip cannot be edited.');
                abort_if($ride->bookings()->exists(), 409, 'Accepted terms are locked. Cancel this ride with passenger notification and publish a replacement.');
            }
            $policy = CarpoolPolicy::where('region', $data['region'])->latest('version')->firstOrFail();
            abort_unless($policy->enabled, 422, 'Carpool is not enabled in this market.');
            $bounds = $policy->rules['bounds'] ?? null;
            abort_unless($bounds, 422, 'Configure a reviewed geographic service area for this region.');
            foreach (['origin', 'destination'] as $point) {
                abort_unless($data[$point.'_lat'] >= $bounds['south'] && $data[$point.'_lat'] <= $bounds['north']
                    && $data[$point.'_lng'] >= $bounds['west'] && $data[$point.'_lng'] <= $bounds['east'], 422, 'Both route endpoints must be inside the selected regional service area.');
            }
            $departure = Carbon::parse($data['departure_at'])->utc();
            abort_unless($departure->gt(now()), 422, 'Choose a future departure.');
            $direct = $this->distance($data['origin_lat'], $data['origin_lng'], $data['destination_lat'], $data['destination_lng']);
            abort_if($direct < $policy->rules['min_distance_m'] || $data['distance_m'] < $direct || $data['distance_m'] > $direct * $policy->rules['max_route_factor'], 422, 'Invalid intercity route or implausible distance estimate.');
            $snapshot = app(CarpoolPricing::class)->quote($policy, $vehicle, $data['distance_m'], $data['toll_minor'], $data['seats']);
            abort_if($data['price_minor'] > $snapshot['max_seat_minor'] || $snapshot['max_total_minor'] < $data['price_minor'] * $data['seats'], 422, 'Contribution exceeds the cost-sharing cap.');
            $end = $departure->copy()->addMinutes($data['duration_minutes'] + 15);
            if ($data['status'] === 'published') {
                $resources->assertAvailable($driver->id, $vehicle->id, $departure, $end, ['exact_interval' => true, 'exclude_carpool_ride_id' => $id]);
            }
            $ride->fill(collect($data)->except(['region', 'toll_minor'])->all());
            $ride->fill(['driver_id' => $driver->id, 'carpool_policy_id' => $policy->id, 'currency' => $policy->currency,
                'departure_at' => $departure, 'ends_at' => $end, 'pricing_snapshot' => $snapshot])->save();
            $this->audit($ride, $id ? 'ride.edited' : 'ride.created', $driver);

            return $ride;
        }, 5);
    }

    public function distance(float $a, float $b, float $c, float $d): int
    {
        $h = sin(deg2rad($c - $a) / 2) ** 2 + cos(deg2rad($a)) * cos(deg2rad($c)) * sin(deg2rad($d - $b) / 2) ** 2;

        return (int) round(12742000 * asin(sqrt(min(1, $h))));
    }

    public function active(CarpoolRide $ride)
    {
        return $ride->bookings()->where(function ($q) {
            $q->where('status', 'confirmed')->orWhere(fn ($q) => $q->where('status', 'reserved')->where('expires_at', '>', now()));
        });
    }

    public function remaining(CarpoolRide $ride): int
    {
        return max(0, $ride->seats - (int) $this->active($ride)->sum('seats'));
    }

    public function expire(CarpoolRide $ride): void
    {
        foreach ($ride->bookings()->whereIn('status', ['requested', 'reserved'])->where('expires_at', '<=', now())->get() as $b) {
            $b->update(['status' => 'expired', 'payment_status' => 'expired']);
            $this->audit($b, 'booking.expired');
            $this->notify($b, 'expired');
        }
    }

    public function book(Model $actor, int $rideId, array $data, string $key): CarpoolBooking
    {
        $this->actor($actor);

        return DB::transaction(function () use ($actor, $rideId, $data, $key) {
            $stub = CarpoolRide::findOrFail($rideId);
            app(ResourceCommitmentService::class)->lockResources($stub->driver_id, $stub->vehicle_id);
            // Serializes same-account idempotency keys across different rides as well.
            $actor->newQuery()->whereKey($actor->id)->lockForUpdate()->firstOrFail();
            $ride = CarpoolRide::lockForUpdate()->findOrFail($rideId);
            $hash = hash('sha256', json_encode([$rideId, $data]));
            $old = CarpoolBooking::where('passenger_type', $actor::class)->where('passenger_id', $actor->id)->where('request_key', $key)->first();
            if ($old) {
                abort_unless(hash_equals($old->request_hash, $hash), 409, 'Idempotency key already used for different terms.');

                return $old;
            }
            $this->expire($ride);
            $this->bookable($ride);
            abort_if(($actor instanceof Driver && $actor->id === $ride->driver_id) || $actor->phone === $ride->driver->phone, 422, 'You cannot book your own ride.');
            abort_if($ride->bookings()->whereIn('status', ['requested', 'reserved', 'confirmed'])
                ->whereHasMorph('passenger', [Customer::class, Driver::class], fn ($q) => $q->where('phone', $actor->phone)->whereNotNull('phone_verified_at'))
                ->exists(), 409, 'You already have an active booking or request.');
            $rules = $ride->pricing_snapshot['rules'];
            abort_unless(is_int($data['seats']) && $data['seats'] >= 1 && $data['seats'] <= 12, 422, 'Invalid seat count.');
            abort_unless(in_array($data['payment_method'], $rules['payment_methods']), 422, 'Payment method unavailable in this region.');
            abort_if($data['payment_method'] === 'online' && ! app(CarpoolPayments::class)->available(), 422, 'Online carpool payments are not configured.');
            abort_if($data['payment_method'] === 'cash' && ($rules['fee_bps'] || $rules['fee_fixed_minor']), 422, 'Cash markets require zero platform fees.');
            abort_unless($data['policy_version'] === $ride->pricing_snapshot['version'] && $data['price_minor'] === $ride->price_minor, 409, 'Ride terms changed. Review them again.');
            $contribution = $data['seats'] * $ride->price_minor;
            $fee = intdiv($contribution * $rules['fee_bps'] + 9999, 10000) + $rules['fee_fixed_minor'];
            $status = $ride->booking_mode === 'approval' ? 'requested' : ($data['payment_method'] === 'cash' ? 'confirmed' : 'reserved');
            if ($status !== 'requested') {
                $this->capacity($ride, $data['seats'], $contribution);
            }
            $b = $ride->bookings()->create([
                'passenger_type' => $actor::class, 'passenger_id' => $actor->id, 'request_key' => $key, 'request_hash' => $hash,
                'seats' => $data['seats'], 'status' => $status, 'payment_method' => $data['payment_method'],
                'expires_at' => $status === 'confirmed' ? null : min($ride->departure_at, now()->addMinutes($status === 'requested' ? $rules['approval_minutes'] : $rules['hold_minutes'])),
                'contribution_minor' => $contribution, 'fee_minor' => $fee, 'total_minor' => $contribution + $fee, 'currency' => $ride->currency,
                'terms' => ['ride' => $ride->toArray(), 'pricing' => $ride->pricing_snapshot, 'cancellation' => $rules['cancellation']],
                'pin' => (string) random_int(100000, 999999),
            ]);
            $this->audit($b, 'booking.'.$status, $actor);
            $this->notify($b, $status);

            return $b;
        }, 5);
    }

    public function bookable(CarpoolRide $ride): void
    {
        abort_unless($ride->status === 'published' && $ride->departure_at->gt(now()), 409, 'Ride is no longer bookable.');
        $policy = CarpoolPolicy::where('region', $ride->pricing_snapshot['region'])->latest('version')->first();
        abort_unless($policy?->enabled, 422, 'Market is paused.');
        abort_unless($ride->vehicle->isApprovedForService() && $ride->driver->is_active && $ride->driver->is_approved, 422, 'Driver or vehicle is no longer eligible.');
        $this->driver($ride->driver);
        abort_if($ride->seats > $ride->vehicle->seats - 1, 409, 'Vehicle capacity changed; driver must cancel this ride.');
        $snap = $ride->pricing_snapshot;
        abort_if($ride->price_minor > $snap['max_seat_minor'] || $ride->price_minor * $ride->seats > $snap['max_total_minor'], 422, 'Contribution exceeds accepted policy limits.');
    }

    private function capacity(CarpoolRide $ride, int $seats, int $amount): void
    {
        abort_if($this->remaining($ride) < $seats, 409, 'Not enough seats remain.');
        abort_if($this->active($ride)->sum('contribution_minor') + $amount > $ride->pricing_snapshot['max_total_minor'], 422, 'Trip contribution limit reached.');
    }

    public function passenger(CarpoolBooking $b, Model $actor): bool
    {
        return $b->passenger_type === $actor::class && $b->passenger_id === $actor->id;
    }

    public function owns(CarpoolRide $ride, Model $actor): bool
    {
        return $this->linkedDriver($actor)?->id === $ride->driver_id;
    }

    public function bookingAction(Model $actor, int $id, string $action, array $data = []): CarpoolBooking
    {
        $this->actor($actor);
        $stub = CarpoolBooking::findOrFail($id);

        return DB::transaction(function () use ($actor, $stub, $action, $data) {
            if ($action === 'approve') {
                $trip = CarpoolRide::findOrFail($stub->carpool_ride_id);
                app(ResourceCommitmentService::class)->lockResources($trip->driver_id, $trip->vehicle_id);
            }
            $ride = CarpoolRide::lockForUpdate()->findOrFail($stub->carpool_ride_id);
            $this->expire($ride);
            $b = CarpoolBooking::lockForUpdate()->findOrFail($stub->id);
            $driver = $this->owns($ride, $actor);
            $passenger = $this->passenger($b, $actor);
            abort_unless($driver || $passenger, 403);
            if (in_array($action, ['approve', 'reject'])) {
                abort_unless($driver, 403);
                abort_unless($b->status === 'requested', 409, 'Request is no longer pending.');
                if ($action === 'approve') {
                    $this->bookable($ride);
                    $this->capacity($ride, $b->seats, $b->contribution_minor);
                    $b->status = $b->payment_method === 'cash' ? 'confirmed' : 'reserved';
                    $b->expires_at = $b->status === 'confirmed' ? null : min($ride->departure_at, now()->addMinutes($b->terms['pricing']['rules']['hold_minutes']));
                } else {
                    $b->status = 'rejected';
                }
            } elseif ($action === 'cancel') {
                abort_unless($passenger, 403);
                if ($b->status === 'cancelled') {
                    return $b;
                }
                abort_unless(in_array($b->status, ['requested', 'reserved', 'confirmed']) && $ride->status === 'published', 409, 'Cancellation is no longer available.');
                $this->cancelBooking($b, false);
            } elseif ($action === 'check-in') {
                abort_unless($driver && $b->status === 'confirmed' && in_array($ride->status, ['published', 'in_progress']), 403);
                abort_unless(now()->gte($ride->departure_at->copy()->subHours(2)) && hash_equals($b->pin, $data['pin'] ?? ''), 422, 'Invalid PIN or check-in window.');
                $b->checked_in_at = $b->checked_in_at ?? now();
                $b->attendance = 'checked_in';
            } elseif ($action === 'no-show') {
                abort_unless($driver && $ride->departure_at->copy()->addMinutes($b->terms['pricing']['rules']['no_show_minutes'])->lte(now()) && $b->status === 'confirmed' && ! $b->checked_in_at && in_array($ride->status, ['published', 'in_progress']), 409);
                $b->attendance = 'no_show';
                $this->noShowRefund($b);
            } elseif ($action === 'cash-collected') {
                abort_unless($driver && $ride->status === 'completed' && $b->status === 'confirmed' && $b->attendance === 'checked_in' && $b->payment_method === 'cash', 403);
                app(CarpoolPayments::class)->cash($b);
                $b->refresh();
            } else {
                abort(422, 'Unknown action.');
            }
            $b->save();
            $this->audit($b, 'booking.'.$action, $actor);
            $this->notify($b, $action);

            return $b;
        }, 5);
    }

    public function cancelBooking(CarpoolBooking $b, bool $driver): void
    {
        $terms = $b->terms['cancellation'];
        $early = now()->lte($b->ride->departure_at->copy()->subHours($terms['free_hours']));
        $bps = $driver || $early ? 10000 : $terms['late_refund_bps'];
        $b->status = 'cancelled';
        $b->payout_status = 'ineligible';
        if ($b->payment_status === 'paid') {
            foreach ($b->payments()->where('method', 'online')->get() as $payment) {
                $notes = $payment->notes ?? [];
                if (! ($notes['late_capture'] ?? false)) {
                    $notes['refund_due_minor'] = intdiv($payment->amount_minor * $bps, 10000);
                }
                $payment->update(['notes' => $notes]);
            }
            $b->refund_minor = $b->payments()->get()->sum(fn ($p) => $p->notes['refund_due_minor'] ?? 0);
            $b->refund_status = $b->refund_minor > 0 ? 'pending' : 'none';
        }
        $b->save();
    }

    private function noShowRefund(CarpoolBooking $b): void
    {
        if ($b->payment_method !== 'online' || $b->payment_status !== 'paid') {
            return;
        }
        $bps = $b->terms['pricing']['rules']['no_show_refund_bps'] ?? 10000;
        foreach ($b->payments()->where('method', 'online')->get() as $p) {
            $notes = $p->notes ?? [];
            if (! ($notes['late_capture'] ?? false)) {
                $notes['refund_due_minor'] = intdiv($p->amount_minor * $bps, 10000);
            }
            $p->update(['notes' => $notes]);
        }
        $b->refund_minor = $b->payments()->get()->sum(fn ($p) => $p->notes['refund_due_minor'] ?? 0);
        $b->refund_status = $b->refund_minor > 0 ? 'pending' : 'none';
        $b->payout_status = 'ineligible';
    }

    public function rideAction(Model $actor, int $id, string $action, ?string $reason = null): CarpoolRide
    {
        return DB::transaction(function () use ($actor, $id, $action, $reason) {
            $ride = CarpoolRide::lockForUpdate()->findOrFail($id);
            abort_unless($this->owns($ride, $actor) || ($actor instanceof \App\Models\User && $actor->isAdmin() && $action === 'cancel'), 403);
            $this->expire($ride);
            if ($action === 'cancel') {
                if ($ride->status === 'cancelled') {
                    return $ride;
                }
                abort_unless(in_array($ride->status, ['draft', 'published']), 409);
                foreach ($ride->bookings()->whereIn('status', ['requested', 'reserved', 'confirmed'])->get() as $b) {
                    $this->cancelBooking($b, true);
                    $this->notify($b, 'driver_cancelled');
                }
                $ride->status = 'cancelled';
            } elseif ($action === 'start') {
                $this->driver($actor);
                abort_unless($ride->vehicle->isApprovedForService(), 422, 'Vehicle verification is no longer valid.');
                abort_unless($ride->status === 'published' && now()->gte($ride->departure_at) && $ride->bookings()->whereNotNull('checked_in_at')->exists(), 409, 'Wait for departure and check in at least one passenger.');
                foreach ($ride->bookings()->whereIn('status', ['reserved', 'requested'])->get() as $b) {
                    $b->update(['status' => 'expired', 'payment_status' => 'expired']);
                    $this->notify($b, 'expired');
                }
                $ride->status = 'in_progress';
            } elseif ($action === 'complete') {
                abort_unless($ride->status === 'in_progress', 409);
                $ride->status = 'completed';
                $ride->completed_at = now();
                foreach ($ride->bookings()->where('status', 'confirmed')->get() as $b) {
                    if (! $b->checked_in_at) {
                        abort_unless($ride->departure_at->copy()->addMinutes($b->terms['pricing']['rules']['no_show_minutes'])->lte(now()), 409, 'Wait for the no-show grace period before completing with absent passengers.');
                        $b->attendance = 'no_show';
                        $this->noShowRefund($b);
                        $b->save();
                        $this->notify($b, 'no-show');
                    }
                    $b->update(['payout_eligible_at' => now()->addHours($b->terms['pricing']['rules']['dispute_hours'])]);
                }
            } else {
                abort(422, 'Unknown action.');
            }
            $ride->save();
            $this->audit($ride, 'ride.'.$action, $actor, ['reason' => $reason]);
            foreach ($ride->bookings()->where('status', 'confirmed')->get() as $b) {
                $this->notify($b, $action);
            }

            return $ride;
        }, 5);
    }

    public function audit(Model $model, string $action, ?Model $actor = null, array $details = []): void
    {
        BookingAuditLog::create(['auditable_type' => $model::class, 'auditable_id' => $model->id, 'action' => 'carpool.'.$action,
            'after' => ['actor' => $actor ? $this->key($actor) : 'system', 'status' => $model->status, ...$details]]);
    }

    public function notify(CarpoolBooking $b, string $event): void
    {
        foreach ([$b->passenger, $b->ride->driver] as $recipient) {
            if (! $recipient) {
                continue;
            }
            app(NotificationService::class)->enqueue($recipient, ['sms'], ['sms' => "Carpool booking #{$b->id}: {$event}. Open My carpool bookings for terms and meeting instructions."],
                ['dedup_key' => 'carpool:'.$b->id.':'.$event.':'.$this->key($recipient)]);
        }
    }
}

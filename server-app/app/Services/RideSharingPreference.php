<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\RideBooking;
use App\Models\SharedTrip;
use Illuminate\Support\Facades\DB;

class RideSharingPreference
{
    public function control(RideBooking $ride): array
    {
        $trip = $ride->shared_trip_id ? SharedTrip::find($ride->shared_trip_id) : null;
        $joined = $ride->shared_offer_id || ($trip && ($trip->root_booking_id != $ride->id
            || $trip->bookings()->whereKeyNot($ride->id)->exists()));
        $active = $ride->service_type === 'point_to_point'
            && in_array($ride->status, ['pending', 'confirmed', ...SharedTripService::ACTIVE], true);

        return ['editable' => $active && ! $joined, 'locked' => (bool) $joined,
            'reason' => $joined ? 'Sharing is locked because another passenger has joined.'
                : ($active ? 'You can change this until another passenger joins. Your booked fare stays the same.' : 'Sharing cannot be changed for this ride.')];
    }

    public function update(Customer $customer, RideBooking $ride, bool $enabled): RideBooking
    {
        return DB::transaction(function () use ($customer, $ride, $enabled) {
            Customer::whereKey($customer->id)->lockForUpdate()->firstOrFail();
            // Match pooling's resource lock order so a join cannot race consent withdrawal.
            app(ResourceCommitmentService::class)->lockResources($ride->driver_id, $ride->vehicle_id);
            $locked = RideBooking::whereKey($ride->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->customer_id == $customer->id, 403);
            abort_unless($locked->driver_id == $ride->driver_id && $locked->vehicle_id == $ride->vehicle_id, 409, 'Your driver changed. Refresh the ride and try again.');
            $trip = $locked->shared_trip_id ? SharedTrip::whereKey($locked->shared_trip_id)->lockForUpdate()->firstOrFail() : null;
            $control = $this->control($locked);
            abort_unless($control['editable'], 409, $control['reason']);
            if ($locked->sharing_requested !== $enabled) {
                if ($trip) {
                    $trip->update(['accepting' => false, 'version' => $trip->version + 1]);
                }
                // This coordinated update is the sole exception to the model's independent-edit
                // guard. No route, seats, fares or payment records change; joins are locked out.
                RideBooking::whereKey($locked->id)->update(['sharing_requested' => $enabled,
                    'sharing_enabled_by' => $enabled ? 'customer' : null, 'ride_mode' => $enabled ? 'shared' : 'private']);
            }

            return $locked->fresh();
        }, 3);
    }
}

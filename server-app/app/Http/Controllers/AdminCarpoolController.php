<?php

namespace App\Http\Controllers;

use App\Models\CarpoolBooking;
use App\Models\CarpoolPolicy;
use App\Models\CarpoolRide;
use App\Services\CarpoolPayments;
use App\Services\CarpoolService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AdminCarpoolController extends Controller
{
    public function index()
    {
        return Inertia::render('admin/Carpool', ['policies' => CarpoolPolicy::latest()->get(), 'rides' => CarpoolRide::with('driver:id,name')->latest()->limit(100)->get(),
            'bookings' => CarpoolBooking::latest()->limit(100)->get()->makeHidden(['terms', 'request_hash']),
            'reviews' => DB::table('carpool_reviews')->latest('id')->limit(100)->get(), 'complaints' => DB::table('carpool_complaints')->latest('id')->limit(100)->get()]);
    }

    public function policy(Request $r)
    {
        $data = $r->validate(['region' => 'required|string|max:64', 'currency' => 'required|in:INR,USD,EUR,GBP,AUD,CAD,SGD', 'enabled' => 'required|boolean',
            'rules' => 'required|array', 'rules.review_note' => 'required|string|min:10|max:2000',
            'rules.bounds' => 'required|array:south,north,west,east',
            'rules.bounds.south' => 'required|numeric|between:-90,90', 'rules.bounds.north' => 'required|numeric|between:-90,90|gt:rules.bounds.south',
            'rules.bounds.west' => 'required|numeric|between:-180,180', 'rules.bounds.east' => 'required|numeric|between:-180,180|gt:rules.bounds.west',
            'rules.fuel_price_minor_per_litre' => 'required|integer|min:1|max:1000000', 'rules.max_toll_minor' => 'required|integer|min:0|max:10000000',
            'rules.consumption_ml_per_km' => 'required|array|min:1', 'rules.consumption_ml_per_km.*' => 'required|integer|min:1|max:1000',
            'rules.vehicle_consumption_ml_per_km' => 'sometimes|array', 'rules.vehicle_consumption_ml_per_km.*' => 'integer|min:1|max:1000',
            'rules.driver_min_bps' => 'required|integer|between:1,10000', 'rules.allocation' => 'required|in:equal_occupants,passenger_pool',
            'rules.fee_bps' => 'required|integer|between:0,10000', 'rules.fee_fixed_minor' => 'required|integer|between:0,100000',
            'rules.payment_methods' => 'required|array|min:1', 'rules.payment_methods.*' => 'required|in:cash,online',
            'rules.hold_minutes' => 'required|integer|between:1,60', 'rules.approval_minutes' => 'required|integer|between:1,2880',
            'rules.dispute_hours' => 'required|integer|between:0,720', 'rules.no_show_minutes' => 'required|integer|between:5,180',
            'rules.no_show_refund_bps' => 'required|integer|between:0,10000',
            'rules.proximity_m' => 'required|integer|between:100,25000', 'rules.min_distance_m' => 'required|integer|between:1000,100000',
            'rules.max_route_factor' => 'required|integer|between:1,5', 'rules.cancellation' => 'required|array:free_hours,late_refund_bps',
            'rules.cancellation.free_hours' => 'required|integer|between:0,168', 'rules.cancellation.late_refund_bps' => 'required|integer|between:0,10000']);
        abort_if(in_array('cash', $data['rules']['payment_methods']) && ($data['rules']['fee_bps'] || $data['rules']['fee_fixed_minor']), 422, 'Direct cash bookings require zero platform fees.');
        if ($data['enabled'] && in_array('online', $data['rules']['payment_methods'])) {
            abort_unless(app(CarpoolPayments::class)->available() && $data['currency'] === 'INR', 422, 'Configure and verify an INR marketplace payout adapter before enabling online payments.');
        }
        DB::transaction(function () use ($r, $data) {
            // A common admin lock also serializes creation of a region's first version.
            DB::table('users')->orderBy('id')->lockForUpdate()->first();
            $version = (int) CarpoolPolicy::where('region', $data['region'])->max('version') + 1;
            $policy = CarpoolPolicy::create([...$data, 'version' => $version, 'created_by' => $r->user()->id]);
            app(CarpoolService::class)->audit($policy, 'policy.created', $r->user(), ['version' => $version, 'rules' => $data['rules']]);
        }, 5);

        return back()->with('success', 'New policy version saved. Existing bookings retain their terms.');
    }

    public function action(Request $r, string $kind, int $id)
    {
        $data = $r->validate(['action' => 'required|string', 'reason' => 'required|string|min:5|max:2000']);
        if ($kind === 'rides') {
            abort_unless($data['action'] === 'cancel', 422);
            app(CarpoolService::class)->rideAction($r->user(), $id, 'cancel', $data['reason']);
        } elseif ($kind === 'bookings') {
            abort_unless(in_array($data['action'], ['settle', 'refund']), 422);
            if ($data['action'] === 'refund') {
                DB::transaction(function () use ($r, $id, $data) {
                    $stub = CarpoolBooking::findOrFail($id);
                    CarpoolRide::lockForUpdate()->findOrFail($stub->carpool_ride_id);
                    $b = CarpoolBooking::lockForUpdate()->findOrFail($id);
                    abort_unless($b->payment_method === 'online' && ! in_array($b->payout_status, ['paid', 'test_paid']), 422, 'Use provider recovery for paid-out funds; direct cash refunds are handled by participants.');
                    foreach ($b->payments()->get() as $p) {
                        $p->update(['notes' => [...($p->notes ?? []), 'refund_due_minor' => $p->amount_minor]]);
                    }
                    $b->update(['refund_minor' => $b->payments()->sum('amount_minor'), 'refund_status' => 'pending', 'payout_status' => 'ineligible']);
                    app(CarpoolService::class)->audit($b, 'refund.authorized', $r->user(), ['reason' => $data['reason']]);
                }, 5);
            }
            app(CarpoolPayments::class)->settle($id);
            app(CarpoolService::class)->audit(CarpoolBooking::findOrFail($id), 'settlement.requested', $r->user(), ['reason' => $data['reason']]);
        } elseif ($kind === 'reviews') {
            abort_unless(in_array($data['action'], ['hidden', 'published']), 422);
            DB::transaction(function () use ($r, $id, $data) {
                $review = DB::table('carpool_reviews')->where('id', $id)->first();
                abort_unless($review, 404);
                DB::table('carpool_reviews')->where('id', $id)->update(['status' => $data['action'], 'updated_at' => now()]);
                app(CarpoolService::class)->audit(CarpoolBooking::findOrFail($review->carpool_booking_id), 'review.moderated', $r->user(), ['review_id' => $id, ...$data]);
            });
        } elseif ($kind === 'complaints') {
            abort_unless($data['action'] === 'resolved', 422);
            DB::transaction(function () use ($r, $id, $data) {
                $complaint = DB::table('carpool_complaints')->where('id', $id)->first();
                abort_unless($complaint, 404);
                $booking = CarpoolBooking::findOrFail($complaint->carpool_booking_id);
                CarpoolRide::lockForUpdate()->findOrFail($booking->carpool_ride_id);
                DB::table('carpool_complaints')->where('id', $id)->update(['status' => 'resolved', 'resolution' => $data['reason'], 'updated_at' => now()]);
                app(CarpoolService::class)->audit($booking, 'complaint.resolved', $r->user(), ['complaint_id' => $id, ...$data]);
            });
        } else {
            abort(404);
        }

        return back()->with('success', 'Action processed.');
    }
}

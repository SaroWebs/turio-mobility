<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarpoolBooking;
use App\Models\CarpoolPolicy;
use App\Models\CarpoolRide;
use App\Models\Driver;
use App\Models\PaymentOrder;
use App\Services\CarpoolPayments;
use App\Services\CarpoolService;
use App\Services\RazorpayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CarpoolController extends Controller
{
    public function __construct(private CarpoolService $service) {}

    public static function rideRules(): array
    {
        return ['region' => 'required|string|max:64', 'vehicle_id' => 'required|integer', 'status' => 'required|in:draft,published',
            'origin' => 'required|string|max:255', 'destination' => 'required|string|max:255',
            'origin_lat' => 'required|numeric|between:-90,90', 'origin_lng' => 'required|numeric|between:-180,180',
            'destination_lat' => 'required|numeric|between:-90,90', 'destination_lng' => 'required|numeric|between:-180,180',
            'meeting' => 'required|array:pickup,dropoff,instructions', 'meeting.pickup' => 'required|string|max:500', 'meeting.dropoff' => 'required|string|max:500', 'meeting.instructions' => 'nullable|string|max:1500',
            'departure_at' => ['required', 'date', 'regex:/[T ].*(Z|[+-]\d{2}:\d{2})$/'], 'timezone' => ['required', Rule::in(timezone_identifiers_list())],
            'distance_m' => 'required|integer|min:1000|max:5000000', 'duration_minutes' => 'required|integer|min:15|max:4320',
            'seats' => 'required|integer|min:1|max:12', 'price_minor' => 'required|integer|min:1|max:100000000', 'toll_minor' => 'required|integer|min:0|max:100000000',
            'booking_mode' => 'required|in:instant,approval', 'luggage' => 'required|string|max:255', 'notes' => 'nullable|string|max:2000',
            'preferences' => 'required|array:smoking,pets,ac', 'preferences.smoking' => 'required|boolean', 'preferences.pets' => 'required|boolean', 'preferences.ac' => 'required|boolean'];
    }

    public function configuration(Request $r)
    {
        $policies = CarpoolPolicy::orderByDesc('version')->get()->unique('region')->where('enabled', true)->values();
        $actor = $r->user();
        $driver = $this->service->linkedDriver($actor);

        return response()->json(['data' => ['policies' => $policies, 'can_offer' => $driver !== null,
            'vehicles' => $driver ? $driver->vehicle()->get(['id', 'make', 'model', 'seats', 'fuel_type', 'approval_status']) : [],
            'online_available' => app(CarpoolPayments::class)->available(), 'test_payments' => app(CarpoolPayments::class)->testMode()]]);
    }

    public function search(Request $r)
    {
        $data = $r->validate(['origin' => 'nullable|string|max:255', 'destination' => 'nullable|string|max:255', 'date' => 'nullable|date_format:Y-m-d',
            'currency' => 'required_with:max_price|nullable|in:INR,USD,EUR,GBP,AUD,CAD,SGD',
            'seats' => 'nullable|integer|min:1|max:12', 'sort' => 'nullable|in:price,departure,seats,rating', 'max_price' => 'nullable|integer|min:0',
            'after_time' => 'nullable|date_format:H:i', 'instant' => 'nullable|boolean', 'verified' => 'nullable|boolean', 'min_rating' => 'nullable|numeric|between:0,5',
            'smoking' => 'nullable|boolean', 'pets' => 'nullable|boolean', 'ac' => 'nullable|boolean',
            'origin_lat' => 'nullable|numeric|between:-90,90', 'origin_lng' => 'required_with:origin_lat|numeric|between:-180,180',
            'destination_lat' => 'nullable|numeric|between:-90,90', 'destination_lng' => 'required_with:destination_lat|numeric|between:-180,180']);
        $regions = CarpoolPolicy::orderByDesc('version')->get()->unique('region')->where('enabled', true)->pluck('region');
        $q = CarpoolRide::with(['driver', 'vehicle'])->where('status', 'published')->where('departure_at', '>', now())
            ->whereIn('pricing_snapshot->region', $regions)->orderBy('departure_at');
        foreach (['origin', 'destination'] as $field) {
            if (! empty($data[$field]) && ! isset($data[$field.'_lat'])) {
                $q->where($field, 'like', '%'.$data[$field].'%');
            }
        }
        if (! empty($data['instant'])) {
            $q->where('booking_mode', 'instant');
        }
        if (isset($data['max_price'])) {
            $q->where('price_minor', '<=', $data['max_price']);
        }
        if (! empty($data['currency'])) {
            $q->where('currency', $data['currency']);
        }
        foreach (['smoking', 'pets', 'ac'] as $preference) {
            if (isset($data[$preference])) {
                $q->where('preferences->'.$preference, (bool) $data[$preference]);
            }
        }
        // Full-route endpoint proximity only; no intermediate-seat promises.
        $rows = $q->get()->filter(function ($ride) use ($data) {
            if (! $ride->driver?->is_active || ! $ride->driver->is_approved || ! $ride->vehicle?->isApprovedForService()) {
                return false;
            }
            if (! empty($data['verified']) && (! $ride->driver->approved_at || ! app(\App\Services\DriverVerificationService::class)->summary($ride->driver)['is_complete'])) {
                return false;
            }
            $local = $ride->departure_at->copy()->timezone($ride->timezone);
            if (! empty($data['date']) && $local->toDateString() !== $data['date']) {
                return false;
            }
            if (! empty($data['after_time']) && $local->format('H:i') < $data['after_time']) {
                return false;
            }
            foreach (['origin', 'destination'] as $point) {
                if (isset($data[$point.'_lat']) && $this->service->distance($data[$point.'_lat'], $data[$point.'_lng'], $ride->{$point.'_lat'}, $ride->{$point.'_lng'}) > $ride->pricing_snapshot['rules']['proximity_m']) {
                    return false;
                }
            }

            return $this->service->remaining($ride) >= ($data['seats'] ?? 1);
        })->map(fn ($ride) => $this->publicRide($ride, $data['seats'] ?? 1));
        if (isset($data['min_rating'])) {
            $rows = $rows->where('driver.rating', '>=', $data['min_rating']);
        }
        $rows = match ($data['sort'] ?? 'departure') {
            'price' => $rows->sortBy([['currency', 'asc'], ['total_minor', 'asc']]), 'seats' => $rows->sortByDesc('remaining_seats'), 'rating' => $rows->sortByDesc('driver.rating'), default => $rows,
        };

        return response()->json(['data' => $rows->values()]);
    }

    public function publicRide(CarpoolRide $ride, int $seats = 1): array
    {
        $driverKey = Driver::class.':'.$ride->driver_id;
        $reviews = DB::table('carpool_reviews')->where('counterpart_key', $driverKey)->where('status', 'published');
        $rules = $ride->pricing_snapshot['rules'];
        $contribution = $ride->price_minor * $seats;
        $fee = intdiv($contribution * $rules['fee_bps'] + 9999, 10000) + $rules['fee_fixed_minor'];

        return [...$ride->only(['id', 'status', 'origin', 'destination', 'origin_lat', 'origin_lng', 'destination_lat', 'destination_lng', 'departure_at', 'timezone', 'distance_m', 'duration_minutes', 'seats', 'price_minor', 'currency', 'booking_mode', 'preferences', 'luggage']),
            'service' => 'carpool', 'remaining_seats' => $this->service->remaining($ride), 'contribution_minor' => $contribution, 'fee_minor' => $fee, 'total_minor' => $contribution + $fee,
            'pricing_snapshot' => $ride->pricing_snapshot, 'cancellation' => $rules['cancellation'], 'policy_version' => $ride->pricing_snapshot['version'],
            'pickup_area' => $ride->origin, 'dropoff_area' => $ride->destination,
            'driver' => ['name' => $ride->driver->name, 'verified' => (bool) ($ride->driver->is_approved && $ride->driver->approved_at && app(\App\Services\DriverVerificationService::class)->summary($ride->driver)['is_complete']),
                'completed_trips' => CarpoolRide::where('driver_id', $ride->driver_id)->where('status', 'completed')->count(),
                'rating' => (clone $reviews)->avg('rating'), 'reviews' => (clone $reviews)->latest('id')->limit(10)->get(['rating', 'body'])],
            'vehicle' => $ride->vehicle->only(['make', 'model', 'color', 'is_ac', 'seats'])];
    }

    public function show(CarpoolRide $ride)
    {
        abort_unless($ride->status === 'published', 404);

        return response()->json(['data' => $this->publicRide($ride)]);
    }

    public function save(Request $r, ?CarpoolRide $ride = null)
    {
        $ride = $this->service->save($r->user(), $r->validate(self::rideRules()), $ride?->id);

        return response()->json(['data' => $ride]);
    }

    public function mine(Request $r)
    {
        $actor = $r->user();
        $this->service->actor($actor);
        $bookings = CarpoolBooking::where('passenger_type', $actor::class)->where('passenger_id', $actor->id)->latest()->get();
        $driver = $this->service->linkedDriver($actor);
        $offered = $driver ? CarpoolRide::where('driver_id', $driver->id)->latest()->get() : collect();

        return response()->json(['data' => ['bookings' => $bookings->map(fn ($b) => $this->bookingData($b, $actor)),
            'offered' => $offered->map(fn ($ride) => [...$ride->toArray(), 'remaining_seats' => $this->service->remaining($ride), 'bookings' => $ride->bookings->map(fn ($b) => $this->bookingData($b, $actor))])]]);
    }

    private function bookingData(CarpoolBooking $b, $actor): array
    {
        $confirmed = $b->status === 'confirmed';
        $data = $b->toArray();
        unset($data['terms'], $data['passenger_type'], $data['passenger_id'], $data['request_hash']);
        $data['ride'] = $this->publicRide($b->ride, $b->seats);
        $data['accepted_pricing'] = $b->terms['pricing'];
        $data['cancellation'] = $b->terms['cancellation'];
        if ($confirmed) {
            $data['meeting'] = $b->terms['ride']['meeting'];
            $data['notes'] = $b->terms['ride']['notes'];
            $data['contact'] = $this->service->passenger($b, $actor) ? $b->ride->driver->phone : $b->passenger?->phone;
            if ($this->service->passenger($b, $actor)) {
                $data['pin'] = $b->pin;
            }
        }

        return $data;
    }

    public function book(Request $r, CarpoolRide $ride)
    {
        $data = $r->validate(['seats' => 'required|integer|min:1|max:12', 'payment_method' => 'required|in:cash,online', 'policy_version' => 'required|integer', 'price_minor' => 'required|integer', 'accept_terms' => 'required|accepted']);
        $key = $r->header('Idempotency-Key');
        abort_unless(is_string($key) && strlen($key) >= 8 && strlen($key) <= 100, 422, 'A stable Idempotency-Key is required.');

        return response()->json(['data' => $this->bookingData($this->service->book($r->user(), $ride->id, $data, $key), $r->user())]);
    }

    public function bookingAction(Request $r, CarpoolBooking $booking, string $action)
    {
        $data = $r->validate(['pin' => 'nullable|string|size:6']);

        return response()->json(['data' => $this->bookingData($this->service->bookingAction($r->user(), $booking->id, $action, $data), $r->user())]);
    }

    public function rideAction(Request $r, CarpoolRide $ride, string $action)
    {
        return response()->json(['data' => $this->service->rideAction($r->user(), $ride->id, $action)]);
    }

    public function review(Request $r, CarpoolBooking $booking)
    {
        $this->service->actor($r->user());
        $data = $r->validate(['rating' => 'required|integer|between:1,5', 'body' => 'required|string|max:2000']);

        return DB::transaction(function () use ($r, $booking, $data) {
            $b = CarpoolBooking::lockForUpdate()->findOrFail($booking->id);
            $passenger = $this->service->passenger($b, $r->user());
            abort_unless($passenger || $this->service->owns($b->ride, $r->user()), 403);
            abort_unless($b->status === 'confirmed' && $b->ride->status === 'completed' && $b->checked_in_at, 422, 'Reviews require a completed shared trip.');
            $key = $passenger ? $this->service->key($r->user()) : Driver::class.':'.$b->ride->driver_id;
            abort_if(DB::table('carpool_reviews')->where('carpool_booking_id', $b->id)->where('reviewer_key', $key)->exists(), 409, 'Already reviewed.');
            DB::table('carpool_reviews')->insert([...$data, 'carpool_booking_id' => $b->id, 'reviewer_key' => $key,
                'counterpart_key' => $passenger ? Driver::class.':'.$b->ride->driver_id : $b->passenger_type.':'.$b->passenger_id, 'created_at' => now(), 'updated_at' => now()]);

            return response()->json(['data' => ['message' => 'Review published.']]);
        });
    }

    public function complaint(Request $r, CarpoolBooking $booking)
    {
        $data = $r->validate(['body' => 'required|string|max:4000']);

        return DB::transaction(function () use ($r, $booking, $data) {
            CarpoolRide::lockForUpdate()->findOrFail($booking->carpool_ride_id);
            $b = CarpoolBooking::lockForUpdate()->findOrFail($booking->id);
            abort_unless($this->service->passenger($b, $r->user()) || $this->service->owns($b->ride, $r->user()), 403);
            $id = DB::table('carpool_complaints')->insertGetId([...$data, 'carpool_booking_id' => $b->id, 'reporter_key' => $this->service->key($r->user()), 'created_at' => now(), 'updated_at' => now()]);
            $this->service->audit($b, 'complaint.opened', $r->user(), ['complaint_id' => $id]);

            return response()->json(['data' => ['id' => $id]]);
        });
    }

    public function checkout(Request $r, CarpoolBooking $booking, CarpoolPayments $payments)
    {
        $order = $payments->prepareOrder($payments->checkout($r->user(), $booking->id));

        return response()->json(['data' => ['order_id' => $order->provider_order_id, 'amount' => $order->amount_minor, 'currency' => $order->currency,
            'test' => $order->provider === 'carpool_test', 'key' => config('services.razorpay.key')]]);
    }

    public function testPayment(Request $r, CarpoolBooking $booking, CarpoolPayments $payments)
    {
        abort_unless($payments->testMode(), 404);
        $order = $payments->prepareOrder($payments->checkout($r->user(), $booking->id));
        $payments->capture($order, 'test_capture_'.$order->id, $order->amount_minor, $order->currency);

        return response()->json(['data' => ['message' => 'Test payment captured. No money moved.']]);
    }

    public function webhook(Request $r, CarpoolPayments $payments)
    {
        abort_unless(filled(config('services.razorpay.webhook_secret')) && app(RazorpayService::class)->verifyWebhook($r->getContent(), $r->header('X-Razorpay-Signature', '')), 401);
        $entity = $r->input('payload.payment.entity', []);
        $order = PaymentOrder::where('provider', 'razorpay')->where('provider_order_id', $entity['order_id'] ?? '')->where('payable_type', CarpoolBooking::class)->first();
        if ($order && $r->input('event') === 'payment.captured') {
            $payments->capture($order, $entity['id'], (int) $entity['amount'], $entity['currency']);
        }
        if ($order && $r->input('event') === 'payment.failed') {
            $payments->fail($order);
        }

        return response()->json(['received' => true]);
    }
}

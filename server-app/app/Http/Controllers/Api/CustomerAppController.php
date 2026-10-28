<?php

namespace App\Http\Controllers\Api;

use App\Events\NewRideRequest;
use App\Events\RideStatusUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerApp\BookingReceiptResource;
use App\Http\Resources\CustomerApp\PlaceDetailResource;
use App\Http\Resources\CustomerApp\PlaceMediaResource;
use App\Http\Resources\CustomerApp\PlaceSummaryResource;
use App\Http\Resources\CustomerApp\TourResource;
use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\CarRentalReview;
use App\Models\CmsContent;
use App\Models\CustomerCoupon;
use App\Models\DriverAvailability;
use App\Models\Place;
use App\Models\PlaceMedia;
use App\Models\PlaceReview;
use App\Models\RideBooking;
use App\Models\RideBookingReview;
use App\Models\RideBookingTip;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourBookingReview;
use App\Models\TourSchedule;
use App\Models\Vehicle;
use App\Models\Wallet;
use App\Rules\FileIsClean;
use App\Services\BookingCancellationService;
use App\Services\BookingLifecycleNotifier;
use App\Services\CustomerCouponService;
use App\Services\DriverDispatchService;
use App\Services\RideEstimateService;
use App\Services\StartVerificationService;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CustomerAppController extends Controller
{
    public function publicBootstrap()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'featured_tours' => app(\App\Services\TourSearchService::class)->query([])->take(6)->get()->map(fn (Tour $tour) => $this->formatPublicTour($tour)),
                'featured_destinations' => Place::with(['media' => fn ($query) => $query->approved()])
                    ->where('is_active', true)
                    ->orderBy('name')
                    ->take(8)
                    ->get()
                    ->map(fn (Place $place) => $this->formatPublicPlaceSummary($place)),
                'car_categories' => CarCategory::active()->take(6)->get()
                    ->map(fn (CarCategory $category) => $this->formatPublicCarCategory($category)),
                'cms' => CmsContent::publishedPayload('customer-web'),
            ],
        ]);
    }

    public function publicTours(Request $request)
    {
        $filters = $request->validate([
            'q' => 'nullable|string|max:120', 'date' => 'nullable|date_format:Y-m-d',
            'month' => 'nullable|date_format:Y-m', 'guests' => 'nullable|integer|min:1|max:200',
            'category' => 'nullable|string|max:80',
            'difficulty' => 'nullable|in:easy,moderate,challenging,extreme',
            'page' => 'nullable|integer|min:1', 'per_page' => 'nullable|integer|min:1|max:50',
            'cursor' => 'nullable|string|max:255',
            'pagination' => 'nullable|string|in:cursor,offset',
            'destination_id' => 'nullable|integer|exists:places,id',
            'price_range' => 'nullable|in:all,under_5k,5k_to_15k,above_15k',
            'duration' => 'nullable|in:all,day_trip,2_3_days,4_plus_days',
            'min_rating' => 'nullable|numeric|min:1|max:5',
            'sort' => 'nullable|in:departure,availability,price_asc,price_desc,duration',
        ]);
        $searchService = app(\App\Services\TourSearchService::class);

        // Opt-in cursor pagination: stable under concurrent bookings/cancellations
        if ($request->has('cursor') || $request->input('pagination') === 'cursor') {
            if (! empty($filters['sort'])) {
                throw \Illuminate\Validation\ValidationException::withMessages(['sort' => 'Custom ordering requires offset pagination.']);
            }
            $perPage = (int) ($filters['per_page'] ?? 20);
            $cursorResult = $searchService->paginateCursor($filters, $perPage, $request->input('cursor'));

            return response()->json([
                'success' => true,
                'data' => $cursorResult['items']->map(fn (Tour $tour) => $this->formatPublicTour($tour)),
                'pagination' => [
                    'type' => 'cursor',
                    'per_page' => $perPage,
                    'next_cursor' => $cursorResult['next_cursor'],
                    'has_more' => $cursorResult['has_more'],
                ],
            ]);
        }

        $query = $searchService->query($filters);
        // Opt-in offset pagination preserves the existing mobile response contract.
        if ($request->has('page') || $request->has('per_page')) {
            $page = $query->paginate($filters['per_page'] ?? 20);

            return response()->json([
                'success' => true,
                'data' => $page->getCollection()->map(fn (Tour $tour) => $this->formatPublicTour($tour)),
                'pagination' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            ]);
        }

        return response()->json(['success' => true, 'data' => $query->get()->map(fn (Tour $tour) => $this->formatPublicTour($tour))]);
    }

    public function subscribeNewsletter(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'source' => 'nullable|string|max:100',
        ]);

        $subscription = \App\Models\NewsletterSubscription::firstOrCreate(
            ['email' => strtolower($validated['email'])],
            ['source' => $validated['source'] ?? 'website_footer', 'is_active' => true]
        );

        return response()->json([
            'success' => true,
            'message' => 'Thank you for subscribing to the Turiya Mobility newsletter!',
            'data' => [
                'email' => $subscription->email,
                'subscribed_at' => optional($subscription->created_at)->toIso8601String() ?? now()->toIso8601String(),
            ],
        ]);
    }

    public function publicTour(Tour $tour)
    {
        abort_unless(
            $tour->is_active
            && (! $tour->available_from || $tour->available_from->lte(now()))
            && (! $tour->available_to || $tour->available_to->gte(now()->startOfDay())),
            404
        );

        $tour->load(['category', 'itineraries.place.media' => fn ($query) => $query->approved(), 'schedules' => function ($q) {
            $q->bookable();
        }]);

        return response()->json([
            'success' => true,
            'data' => $this->formatPublicTour($tour, true),
        ]);
    }

    public function tourSchedules(Tour $tour)
    {
        abort_unless($tour->is_active, 404);

        $schedules = $tour->schedules()
            ->bookable()
            ->get()
            ->map(fn (TourSchedule $schedule) => [
                'id' => $schedule->id,
                'departure_date' => optional($schedule->departure_date)->toDateString(),
                'return_date' => optional($schedule->return_date)->toDateString(),
                'departure_time' => $schedule->departure_time,
                'departure_point' => $schedule->departure_point,
                'available_seats' => max(0, $schedule->getAvailableSeats()),
                'price' => $schedule->getEffectivePrice(),
                'child_price' => $schedule->getEffectiveChildPrice(),
                'status' => $schedule->getAvailableSeats() > 0 ? $schedule->status : 'sold_out',
            ]);

        return response()->json([
            'success' => true,
            'data' => $schedules,
        ]);
    }

    public function publicDestinations()
    {
        return response()->json([
            'success' => true,
            'data' => Place::with(['media' => fn ($query) => $query->approved()])
                ->where('is_active', true)
                ->orderBy('name')
                ->get()
                ->map(fn (Place $place) => $this->formatPublicPlaceSummary($place)),
        ]);
    }

    public function publicPlaces()
    {
        return response()->json([
            'success' => true,
            'data' => Place::with(['media' => fn ($query) => $query->approved()])
                ->where('is_active', true)
                ->orderByDesc('is_featured')
                ->orderByDesc('rating')
                ->get()
                ->map(fn (Place $place) => $this->formatPublicPlaceSummary($place)),
        ]);
    }

    public function publicPopularPlaces()
    {
        return response()->json([
            'success' => true,
            'data' => Place::with(['media' => fn ($query) => $query->approved()])
                ->where('is_active', true)
                ->where('is_featured', true)
                ->orderByDesc('rating')
                ->take(12)
                ->get()
                ->map(fn (Place $place) => $this->formatPublicPlaceSummary($place)),
        ]);
    }

    public function publicDestination(Place $place)
    {
        $place->load(['media' => fn ($query) => $query->approved(), 'reviews.customer:id,name']);

        return response()->json([
            'success' => true,
            'data' => $this->formatPlaceDetails($place),
        ]);
    }

    public function publicGooglePlacePhoto(Request $request)
    {
        $validated = $request->validate([
            'reference' => 'required|string|max:4096',
        ]);
        $apiKey = config('services.google_maps.api_key');
        abort_unless($apiKey, 503, 'Google Maps is not configured.');

        $photo = Http::timeout(12)->get('https://maps.googleapis.com/maps/api/place/photo', [
            'photo_reference' => $validated['reference'],
            'maxwidth' => 1200,
            'key' => $apiKey,
        ]);
        abort_unless($photo->ok(), 404, 'Google place photo is unavailable.');

        return response($photo->body(), 200, [
            'Content-Type' => $photo->header('Content-Type', 'image/jpeg'),
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    public function publicCarCategories()
    {
        $categories = CarCategory::active()->get()
            ->map(fn (CarCategory $category) => $this->formatPublicCarCategory($category));

        return response()->json([
            'success' => true,
            'data' => $categories,
            // Kept for older mobile builds that used the original response key.
            'categories' => $categories,
        ]);
    }

    public function publicCarCategory(CarCategory $carCategory)
    {
        abort_unless($carCategory->is_active, 404);

        $carCategory->loadCount([
            'vehicles as available_vehicles_count' => fn ($query) => $query
                ->where('is_active', true)
                ->where('is_available_for_rent', true)
                ->where('approval_status', 'approved')
                ->where(fn ($vehicleQuery) => $vehicleQuery
                    ->whereNull('condition')
                    ->orWhere('condition', '!=', 'under_maintenance')),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                ...$this->formatPublicCarCategory($carCategory),
                'available_vehicles_count' => (int) $carCategory->available_vehicles_count,
            ],
        ]);
    }

    public function publicRentalVehicles(Request $request)
    {
        $dates = $request->validate(['start_date' => 'nullable|required_with:end_date|date_format:Y-m-d', 'end_date' => 'nullable|required_with:start_date|date_format:Y-m-d|after_or_equal:start_date']);
        $vehicles = $this->rentableVehicles()
            ->orderBy('make')
            ->orderBy('model')
            ->get()
            ->filter(function ($vehicle) use ($dates) {
                if (empty($dates['start_date'])) {
                    return true;
                }
                try {
                    app(\App\Services\RentalDriverService::class)->assertAvailable($vehicle, $dates['start_date'], $dates['end_date']);

                    return true;
                } catch (\RuntimeException) {
                    return false;
                }
            })
            ->values()
            ->map(fn (Vehicle $vehicle) => $this->formatPublicRentalVehicle($vehicle));

        return response()->json([
            'success' => true,
            'data' => $vehicles,
        ]);
    }

    public function publicRentalVehicle(Vehicle $vehicle)
    {
        $vehicle = $this->rentableVehicles()->findOrFail($vehicle->id);

        return response()->json([
            'success' => true,
            'data' => $this->formatPublicRentalVehicle($vehicle),
        ]);
    }

    public function uploadPlaceMedia(Request $request, Place $place)
    {
        abort_unless($place->is_active, 404);
        $validated = $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,png,jpg,webp', 'max:10240', new FileIsClean],
            'caption' => 'nullable|string|max:500',
            'is_360' => 'nullable|boolean',
        ]);

        $media = PlaceMedia::create([
            'place_id' => $place->id,
            'uploaded_by_customer_id' => $request->user()->id,
            'path' => $request->file('image')->store('place_media/customer', 'public'),
            'type' => $request->boolean('is_360') ? 'panorama' : 'image',
            'source' => 'customer',
            'approval_status' => 'pending',
            'caption' => $validated['caption'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Photo uploaded and sent to the admin for approval.',
            'data' => (new PlaceMediaResource($media))->resolve($request),
        ], 201);
    }

    public function dashboard(Request $request)
    {
        $customer = $request->user();

        return response()->json([
            'success' => true,
            'customer' => $customer,
            'stats' => [
                'tour_bookings' => TourBooking::where('customer_id', $customer->id)->count(),
                'car_rentals' => CarRental::where('customer_id', $customer->id)->count(),
                'ride_bookings' => RideBooking::where('customer_id', $customer->id)->count(),
                'wallet_balance' => (float) optional(Wallet::forOwner($customer)->first())->balance,
            ],
            'recent_ride_bookings' => RideBooking::with('driver:id,name,phone')
                ->where('customer_id', $customer->id)
                ->latest()
                ->take(5)
                ->get(),
            'recent_bookings' => TourBooking::with('tour:id,title')
                ->where('customer_id', $customer->id)
                ->latest()
                ->take(5)
                ->get(),
        ]);
    }

    public function tours()
    {
        $tours = Tour::with('itineraries')
            ->where('available_to', '>=', now())
            ->orderBy('available_from')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $tours,
        ]);
    }

    public function tourBookings(Request $request)
    {
        $bookings = TourBooking::with(['tour:id,title', 'reviews:id,tour_booking_id,customer_id,tour_rating,review'])
            ->where('customer_id', $request->user()->id)
            ->latest()
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $bookings,
        ]);
    }

    public function bookTour(Request $request)
    {
        $customer = $request->user();
        abort_unless($customer instanceof \App\Models\Customer, 403);

        $validator = Validator::make($request->all(), [
            'tour_id' => 'required|exists:tours,id',
            'tour_schedule_id' => 'required|exists:tour_schedules,id',
            'upfront_choice' => 'sometimes|in:minimum,custom,full',
            'upfront_amount_minor' => 'nullable|required_if:upfront_choice,custom|integer|min:1',
            'number_of_adults' => 'required|integer|min:1|max:200',
            'number_of_children' => 'nullable|integer|min:0|max:200',
            'payment_method' => 'required|in:cash,wallet',
            'special_requests' => 'nullable|string|max:1000',
            'pickup_option' => 'nullable|string|max:120',
            'insurance_selected' => 'nullable|boolean',
            'coupon_code' => 'nullable|string|max:40',
            'sharing_requested' => 'prohibited',
            'reserved_seats' => 'prohibited',
            'ride_mode' => 'prohibited',
            'car_category_id' => 'prohibited',
            'start_date' => 'prohibited',
            'end_date' => 'prohibited',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $totalPax = (int) $request->number_of_adults + (int) ($request->number_of_children ?? 0);

        if ((int) $request->number_of_adults > (int) setting('tour.max_adults_per_booking', 10)
            || (int) ($request->number_of_children ?? 0) > (int) setting('tour.max_children_per_booking', 10)) {
            return response()->json(['success' => false, 'message' => 'The requested group exceeds the configured traveller limit.'], 422);
        }

        try {
            $booking = DB::transaction(function () use ($request, $customer, $totalPax) {
                $schedule = TourSchedule::with('tour')->lockForUpdate()->findOrFail($request->tour_schedule_id);

                if ((int) $schedule->tour_id !== (int) $request->tour_id) {
                    throw new \RuntimeException('The selected departure does not belong to this tour.');
                }

                if (! TourSchedule::whereKey($schedule->id)->bookable($totalPax)->exists()) {
                    throw new \RuntimeException('This departure has already left. Select a future departure.');
                }

                $tour = $schedule->tour;
                $leadHours = (int) setting('tour.min_lead_time_hours', 0);
                if ($leadHours > 0 && now()->addHours($leadHours)->gt($schedule->departure_at)) {
                    throw new \RuntimeException('This departure is too soon to book.');
                }
                if (! $tour->isAvailableForGuests($totalPax)) {
                    throw new \RuntimeException('The requested group size is outside this tour\'s limits or the tour is not currently bookable.');
                }

                if (! $schedule->isAvailable()) {
                    throw new \RuntimeException('This departure is no longer available or is sold out.');
                }

                if ($schedule->getAvailableSeats() < $totalPax) {
                    throw new \RuntimeException('Only '.$schedule->getAvailableSeats().' seats remaining.');
                }

                $subtotal = \App\Support\Money::toMajor(((int) $request->number_of_adults * \App\Support\Money::toMinor($schedule->getEffectivePrice()))
                    + ((int) ($request->number_of_children ?? 0) * \App\Support\Money::toMinor($schedule->getEffectiveChildPrice())));
                $couponResult = app(CustomerCouponService::class)->preview($customer, $request->input('coupon_code'), 'tour', (float) $subtotal);

                if ($request->filled('coupon_code') && ! $couponResult['eligible']) {
                    throw new \RuntimeException($couponResult['message']);
                }

                $discountAmount = (float) ($couponResult['discount_amount'] ?? 0);
                $feePricing = app(\App\Support\Pricing\PricingService::class)->applyFees((float) $subtotal - $discountAmount);
                $totalPrice = $feePricing['total'];

                $paymentPlan = app(\App\Services\TourDepositService::class)->plan($request, \App\Support\Money::toMinor($totalPrice));

                if ($request->is('api/customer-app/tours/quote')) {
                    return app(\App\Services\BookingQuoteService::class)->issue($request, 'tour', ['subtotal' => $subtotal, 'discount' => $discountAmount, 'tax' => $feePricing['tax'], 'service_fee' => $feePricing['service_fee'], 'total' => $totalPrice, 'available_seats' => $schedule->getAvailableSeats(), 'payment_plan' => $paymentPlan]);
                }
                $claims = app(\App\Services\BookingQuoteService::class)->verify($request, 'tour', (float) $totalPrice);
                if ($paymentPlan) {
                    abort_unless($request->payment_method === 'cash', 422, 'Select cash balance and pay the required deposit online. Stored wallet funds do not qualify.');
                    abort_unless($claims && ($claims['pricing_snapshot']['payment_plan'] ?? null) === $paymentPlan, 422, 'Review a current deposit quote before booking.');
                }
                $booking = TourBooking::create([
                    'payment_plan' => $paymentPlan,
                    'customer_id' => $customer->id,
                    'tour_id' => $schedule->tour_id,
                    'tour_schedule_id' => $schedule->id,
                    'hold_expires_at' => now()->addMinutes((int) setting('tour.hold_minutes', 30)),
                    'number_of_adults' => $request->number_of_adults,
                    'number_of_children' => $request->number_of_children ?? 0,
                    'travel_date' => $schedule->departure_date,
                    'customer_name' => $customer->name,
                    'customer_email' => $customer->email,
                    'customer_phone' => $customer->phone,
                    'price_per_adult' => $schedule->getEffectivePrice(),
                    'price_per_child' => $schedule->getEffectiveChildPrice(),
                    'subtotal' => $subtotal,
                    'discount_amount' => $discountAmount,
                    'tax_amount' => $feePricing['tax'],
                    'service_fee_amount' => $feePricing['service_fee'],
                    'total_price' => $totalPrice,
                    'payment_method' => $request->payment_method,
                    'coupon_code' => $couponResult['eligible'] ? $couponResult['code'] : null,
                    'status' => 'pending',
                    'payment_status' => 'pending',
                    'special_requests' => $this->appendStructuredNotes($request->special_requests, [
                        'pickup_option' => $request->input('pickup_option'),
                        'insurance_selected' => $request->boolean('insurance_selected'),
                    ]),
                    'whatsapp_notification' => true,
                ]);

                $schedule->increment('reserved_seats', $totalPax);

                if ($couponResult['eligible'] && $couponResult['coupon']) {
                    app(CustomerCouponService::class)->redeem($customer, $couponResult['coupon'], $booking, 'tour', (float) $subtotal, $discountAmount);
                }

                // Handle Wallet Payment
                if ($request->payment_method === 'wallet') {
                    $wallet = Wallet::forOwner($customer)->first();
                    if (! $wallet || ! $wallet->hasSufficientBalance($totalPrice)) {
                        throw new \RuntimeException('Insufficient wallet balance.');
                    }
                    app(\App\Services\PaymentService::class)->payTourWithWallet($booking);
                    $booking->refresh();
                }

                return $booking;
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $exception) {
            throw $exception;
        } catch (\RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        if (is_array($booking)) {
            return response()->json(['success' => true, 'data' => $booking]);
        }
        $checkout = null;
        $checkoutMessage = null;
        if ($booking->payment_plan) {
            try {
                $checkout = app(\App\Services\PaymentService::class)->createOrResumeBookingPaymentOrder($booking, $customer)['checkout'];
            } catch (\Throwable $exception) {
                report($exception);
                // The reservation committed before contacting the provider. Never ask the client to create it again.
                $checkoutMessage = 'Reservation saved. Open its payment details to resume checkout or review an uncertain payment order; do not create another booking.';
            }
        }
        app(BookingLifecycleNotifier::class)->emit($booking->fresh('customer'), 'booking.created');
        if ($booking->payment_status === 'paid') {
            app(BookingLifecycleNotifier::class)->emit($booking->fresh('customer'), 'payment.paid');
        }

        return response()->json([
            'success' => true,
            'message' => $booking->payment_plan ? 'Reservation saved. Complete the online deposit to confirm your seats.' : 'Tour booked successfully.',
            'checkout' => $checkout,
            'checkout_message' => $checkoutMessage,
            'data' => $booking->load('tour:id,title'),
            'receipt' => $this->formatBookingReceipt($booking, 'tour'),
        ], 201);
    }

    public function carCategories(Request $request)
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $categories = CarCategory::active()->get();

        if ($startDate && $endDate) {
            $categories->transform(function ($category) use ($startDate, $endDate) {
                $availability = app(\App\Services\RentalDriverService::class)->getCategoryAvailability($category, (string) $startDate, (string) $endDate);
                $category->total_vehicles = $availability['total_vehicles'];
                $category->available_vehicles = $availability['available_vehicles'];
                $category->is_available = $availability['is_available'];

                return $category;
            });
        }

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    public function carRentals(Request $request)
    {
        $rentals = CarRental::with(['carCategory', 'driver:id,name,phone', 'reviews:id,car_rental_id,customer_id,rental_rating,review'])
            ->where('customer_id', $request->user()->id)
            ->latest()
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $rentals,
        ]);
    }

    public function bookCar(Request $request)
    {
        $customer = $request->user();

        $validator = Validator::make($request->all(), [
            'car_category_id' => 'required|exists:car_categories,id',
            'self_drive' => 'prohibited',
            'rental_mode' => 'sometimes|in:with_driver',
            'with_driver' => 'sometimes|accepted',
            'vehicle_id' => 'nullable|integer|exists:vehicles,id',
            'start_date' => 'required|date|after:today',
            'end_date' => 'required|date|after_or_equal:start_date',
            'pickup_location' => 'required|string|max:255',
            'pickup_lat' => 'nullable|numeric|between:-90,90',
            'pickup_lng' => 'nullable|numeric|between:-180,180',
            'dropoff_location' => 'nullable|string|max:255',
            'dropoff_lat' => 'nullable|numeric|between:-90,90',
            'dropoff_lng' => 'nullable|numeric|between:-180,180',
            'destination_details' => 'nullable|string',
            'special_requests' => 'nullable|string',
            'distance_km' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|in:cash,wallet,card,upi,razorpay,online,netbanking',
            'extras' => 'nullable|array',
            'insurance_selected' => 'nullable|boolean',
            'coupon_code' => 'nullable|string|max:40',
            'sharing_requested' => 'prohibited',
            'reserved_seats' => 'prohibited',
            'ride_mode' => 'prohibited',
            'tour_id' => 'prohibited',
            'tour_schedule_id' => 'prohibited',
            'number_of_adults' => 'prohibited',
            'number_of_children' => 'prohibited',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $category = CarCategory::findOrFail($request->car_category_id);
        $selectedVehicle = null;
        if ($request->filled('vehicle_id')) {
            $selectedVehicle = $this->rentableVehicles()
                ->whereKey($request->integer('vehicle_id'))
                ->where('car_category_id', $category->id)
                ->first();

            if (! $selectedVehicle) {
                return response()->json([
                    'success' => false,
                    'message' => 'This vehicle is no longer available for rent.',
                ], 422);
            }
        }

        $startDate = \Carbon\Carbon::parse($request->start_date);
        $endDate = \Carbon\Carbon::parse($request->end_date);
        $numberOfDays = $startDate->diffInDays($endDate) + 1;
        $minDays = (int) setting('rental.min_days', 1, ['category_id' => $category->id]);
        $maxDays = (int) setting('rental.max_days', 0, ['category_id' => $category->id]);
        $leadHours = (int) setting('rental.min_lead_time_hours', 0);
        if ($numberOfDays < $minDays || ($maxDays > 0 && $numberOfDays > $maxDays)) {
            return response()->json(['success' => false, 'message' => 'The rental duration is outside the configured limits.'], 422);
        }
        if ($leadHours > 0 && now()->addHours($leadHours)->gt($startDate->startOfDay())) {
            return response()->json(['success' => false, 'message' => 'This rental pickup is too soon to book.'], 422);
        }
        $distanceKm = (float) ($request->distance_km ?? 0);
        $pricing = $category->calculatePrice($numberOfDays, $distanceKm);
        $couponResult = app(CustomerCouponService::class)->preview($customer, $request->input('coupon_code'), 'rental', (float) $pricing['subtotal']);

        if ($request->filled('coupon_code') && ! $couponResult['eligible']) {
            return response()->json(['success' => false, 'message' => $couponResult['message']], 422);
        }

        $isOnlinePayment = in_array($request->payment_method, ['card', 'upi', 'razorpay', 'online', 'netbanking'], true);
        if ($isOnlinePayment && ! app(\App\Services\PaymentService::class)->isBookingCheckoutEnabled()) {
            return response()->json(['success' => false, 'message' => 'Online booking checkout is not enabled.'], 503);
        }

        try {
            $rental = DB::transaction(function () use ($request, $customer, $category, $selectedVehicle, $numberOfDays, $distanceKm, $pricing, $couponResult, $isOnlinePayment) {
                if (! $selectedVehicle) {
                    foreach ($this->rentableVehicles()->where('car_category_id', $category->id)->orderBy('driver_id')->orderBy('id')->get() as $candidate) {
                        app(\App\Services\ResourceCommitmentService::class)->lockResources($candidate->driver_id, $candidate->id);
                        $candidate = Vehicle::lockForUpdate()->findOrFail($candidate->id);
                        try {
                            app(\App\Services\RentalDriverService::class)->assertAvailable($candidate, $request->start_date, $request->end_date);
                            $selectedVehicle = $candidate;
                            break;
                        } catch (\RuntimeException) {
                            continue;
                        }
                    }
                    if (! $selectedVehicle) {
                        throw new \RuntimeException('No car and driver are available in this category for the selected dates.');
                    }
                }
                if ($selectedVehicle) {
                    app(\App\Services\ResourceCommitmentService::class)->lockResources($selectedVehicle->driver_id, $selectedVehicle->id);
                    $selectedVehicle = Vehicle::whereKey($selectedVehicle->id)->lockForUpdate()->firstOrFail();
                    app(\App\Services\RentalDriverService::class)->assertAvailable($selectedVehicle, $request->start_date, $request->end_date);
                }

                $discountAmount = (float) ($couponResult['discount_amount'] ?? 0);
                $feePricing = app(\App\Support\Pricing\PricingService::class)->applyFees(
                    (float) $pricing['subtotal'] - $discountAmount,
                    ['category_id' => $category->id]
                );
                $deposit = (float) setting('rental.security_deposit_flat', 0.0, ['category_id' => $category->id]);
                $totalPrice = round($feePricing['total'] + $deposit, 2);

                $pricingComponents = [
                    'base_price_per_day' => (float) $category->base_price_per_day,
                    'included_km_per_day' => $category->included_km_per_day !== null ? (float) $category->included_km_per_day : null,
                    'extra_km_charge' => (float) $category->extra_km_charge,
                    'number_of_days' => $numberOfDays,
                    'distance_km' => $distanceKm,
                    'included_km' => $pricing['included_km'],
                    'extra_km' => $pricing['extra_km'],
                    'base_price' => (float) $pricing['base_price'],
                    'distance_price' => (float) $pricing['distance_price'],
                    'subtotal' => (float) $pricing['subtotal'],
                    'discount_amount' => $discountAmount,
                    'tax_amount' => (float) $feePricing['tax'],
                    'service_fee_amount' => (float) $feePricing['service_fee'],
                    'security_deposit' => $deposit,
                    'total_price' => $totalPrice,
                ];

                if ($request->is('api/customer-app/rentals/quote')) {
                    return app(\App\Services\BookingQuoteService::class)->issue($request, 'rental', [
                        'subtotal' => $pricing['subtotal'],
                        'base_price' => $pricing['base_price'],
                        'distance_price' => $pricing['distance_price'],
                        'discount' => $discountAmount,
                        'tax' => $feePricing['tax'],
                        'service_fee' => $feePricing['service_fee'],
                        'deposit' => $deposit,
                        'total' => $totalPrice,
                        'pricing_components' => $pricingComponents,
                    ]);
                }

                $verifiedQuote = app(\App\Services\BookingQuoteService::class)->verify($request, 'rental');
                if ($verifiedQuote && ! empty($verifiedQuote['pricing_snapshot'])) {
                    $snapshot = $verifiedQuote['pricing_snapshot'];
                    $basePrice = (float) ($snapshot['base_price'] ?? $pricing['base_price']);
                    $distancePrice = (float) ($snapshot['distance_price'] ?? $pricing['distance_price']);
                    $discountAmount = (float) ($snapshot['discount_amount'] ?? $snapshot['discount'] ?? $discountAmount);
                    $taxAmount = (float) ($snapshot['tax_amount'] ?? $snapshot['tax'] ?? $feePricing['tax']);
                    $serviceFeeAmount = (float) ($snapshot['service_fee_amount'] ?? $snapshot['service_fee'] ?? $feePricing['service_fee']);
                    $deposit = (float) ($snapshot['security_deposit'] ?? $snapshot['deposit'] ?? $deposit);
                    $totalPrice = (float) ($snapshot['total_price'] ?? $snapshot['total'] ?? $totalPrice);
                } else {
                    $basePrice = (float) $pricing['base_price'];
                    $distancePrice = (float) $pricing['distance_price'];
                    $taxAmount = (float) $feePricing['tax'];
                    $serviceFeeAmount = (float) $feePricing['service_fee'];
                    $snapshot = $pricingComponents;
                }

                $rental = CarRental::create([
                    'customer_id' => $customer->id,
                    'car_category_id' => $category->id,
                    'driver_id' => $selectedVehicle?->driver_id,
                    'vehicle_id' => $selectedVehicle?->id,
                    'customer_name' => $customer->name,
                    'customer_email' => $customer->email,
                    'customer_phone' => $customer->phone,
                    'start_date' => $request->start_date,
                    'end_date' => $request->end_date,
                    'start_time' => $request->input('start_time', '09:00'),
                    'end_time' => $request->input('end_time', '18:00'),
                    'pickup_location' => $request->pickup_location,
                    'pickup_lat' => $request->pickup_lat,
                    'pickup_lng' => $request->pickup_lng,
                    'dropoff_location' => $request->dropoff_location,
                    'dropoff_lat' => $request->dropoff_lat,
                    'dropoff_lng' => $request->dropoff_lng,
                    'destination_details' => $request->destination_details,
                    'number_of_days' => $numberOfDays,
                    'base_price' => $basePrice,
                    'distance_km' => $distanceKm,
                    'distance_price' => $distancePrice,
                    'extras_price' => 0,
                    'discount_amount' => $discountAmount,
                    'tax_amount' => $taxAmount,
                    'service_fee_amount' => $serviceFeeAmount,
                    'security_deposit' => $deposit,
                    'total_price' => $totalPrice,
                    'pricing_snapshot' => $snapshot,
                    'status' => $selectedVehicle ? 'driver_assigned' : 'pending',
                    'payment_status' => 'pending',
                    'hold_expires_at' => $isOnlinePayment ? now()->addMinutes((int) setting('rental.hold_minutes', 30)) : null,
                    'payment_method' => $request->payment_method ?? 'cash',
                    'coupon_code' => $couponResult['eligible'] ? $couponResult['code'] : null,
                    'special_requests' => $this->appendStructuredNotes($request->special_requests, [
                        'extras' => $request->input('extras', []),
                        'insurance_selected' => $request->boolean('insurance_selected'),
                    ]),
                    'whatsapp_notification' => true,
                    'email_notification' => true,
                    'sms_notification' => false,
                ]);

                $rental->auditLogs()->create([
                    'action' => 'pricing.snapshotted',
                    'note' => $verifiedQuote ? 'Rental pricing snapshot locked from quote '.$verifiedQuote['id'] : 'Rental pricing snapshot generated from catalog',
                    'after' => $snapshot,
                ]);

                if ($couponResult['eligible'] && $couponResult['coupon']) {
                    app(CustomerCouponService::class)->redeem($customer, $couponResult['coupon'], $rental, 'rental', (float) $pricing['subtotal'], $discountAmount);
                }

                // Handle Wallet Payment
                if ($request->payment_method === 'wallet') {
                    $wallet = Wallet::forOwner($customer)->first();
                    if (! $wallet || ! $wallet->hasSufficientBalance($totalPrice)) {
                        throw new \RuntimeException('Insufficient wallet balance.');
                    }
                    $wallet->debit($totalPrice, "Payment for Car Rental #{$rental->id}", 'car_rental', $rental->id);
                    $rental->update([
                        'payment_status' => 'paid',
                        'status' => $selectedVehicle ? 'driver_assigned' : 'confirmed',
                    ]);
                }

                return $rental;
            });
        } catch (\RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        if (is_array($rental)) {
            return response()->json(['success' => true, 'data' => $rental]);
        }
        app(BookingLifecycleNotifier::class)->emit($rental->fresh('customer'), 'booking.created');
        if ($rental->payment_status === 'paid') {
            app(BookingLifecycleNotifier::class)->emit($rental->fresh('customer'), 'payment.paid');
        }
        if ($rental->driver_id) {
            app(BookingLifecycleNotifier::class)->emit($rental->fresh('customer'), 'driver.assigned', [
                'driver_id' => $rental->driver_id,
                'vehicle_id' => $rental->vehicle_id,
            ]);
            $driver = \App\Models\Driver::find($rental->driver_id);
            if ($driver) {
                app(BookingLifecycleNotifier::class)->emit($driver, 'rental.driver_assigned', [
                    'rental_id' => $rental->id,
                    'booking_number' => $rental->booking_number,
                    'pickup_location' => $rental->pickup_location,
                    'start_date' => $rental->start_date?->toDateString(),
                    'end_date' => $rental->end_date?->toDateString(),
                ]);
            }
        }

        $checkoutData = null;
        if ($isOnlinePayment) {
            $paymentResult = app(\App\Services\PaymentService::class)->createOrResumeBookingPaymentOrder($rental, $customer);
            $checkoutData = $paymentResult['checkout'];
        }

        $response = [
            'success' => true,
            'message' => 'Car rental booking created successfully.',
            'data' => $rental->load(['carCategory', 'vehicle']),
            'receipt' => $this->formatBookingReceipt($rental, 'rental'),
        ];
        if ($checkoutData) {
            $response['checkout'] = $checkoutData;
        }

        return response()->json($response, 201);
    }

    public function rides(Request $request)
    {
        $rides = RideBooking::with(['driver:id,name,phone', 'reviews:id,ride_booking_id,customer_id,driver_rating,review'])
            ->where('customer_id', $request->user()->id)
            ->latest()
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $rides,
        ]);
    }

    public function currentRide(Request $request)
    {
        abort_unless($request->user() instanceof \App\Models\Customer, 403);
        $ride = RideBooking::where('customer_id', $request->user()->id)
            ->where(function ($query) {
                $query->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
                    ->orWhere(fn ($search) => $search->whereNull('driver_id')
                        ->whereIn('status', ['pending', 'confirmed'])
                        ->where('request_expires_at', '>', now()));
            })
            ->orderByRaw('CASE WHEN driver_id IS NOT NULL THEN 0 ELSE 1 END')
            ->latest('id')->first();

        return response()->json(['success' => true, 'server_time' => now()->toISOString(),
            'data' => $ride?->only(['id', 'status', 'driver_id', 'request_expires_at', 'created_at', 'pickup_location', 'dropoff_location'])]);
    }

    public function showRide(Request $request, RideBooking $booking)
    {
        Gate::authorize('view', $booking);
        $booking->setAttribute('sharing_control', app(\App\Services\RideSharingPreference::class)->control($booking));

        $booking->load([
            'driver:id,name,phone,rating,vehicle_number,vehicle_model,vehicle_color',
            'reviews',
            'tips',
        ]);

        return response()->json([
            'success' => true,
            'data' => $booking,
        ]);
    }

    public function cancelRide(Request $request, RideBooking $booking)
    {
        Gate::authorize('view', $booking);

        if ($booking->isPrePickupPointRide()) {
            return $this->discardPrePickupPointRide($request, $booking);
        }

        return $this->cancelCustomerBooking($request, $booking, 'ride');
    }

    public function estimateRide(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pickup_lat' => 'required|numeric|between:-90,90',
            'pickup_lng' => 'required|numeric|between:-180,180',
            'dropoff_lat' => 'nullable|numeric|between:-90,90',
            'dropoff_lng' => 'nullable|numeric|between:-180,180',
            'service_type' => 'required|in:point_to_point,hourly,hourly_rental,round_trip',
            'scheduled_at' => 'required|date|after:now',
            'coupon_code' => 'nullable|string|max:40',
            'sharing_requested' => 'sometimes|boolean',
            'reserved_seats' => 'sometimes|integer|min:1|max:3',
            'vehicle_class' => 'sometimes|in:mini,comfort,xl',
            'tour_id' => 'prohibited',
            'tour_schedule_id' => 'prohibited',
            'number_of_adults' => 'prohibited',
            'number_of_children' => 'prohibited',
            'car_category_id' => 'prohibited',
            'start_date' => 'prohibited',
            'end_date' => 'prohibited',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->boolean('sharing_requested') && $request->service_type !== 'point_to_point') {
            return response()->json([
                'success' => false,
                'message' => 'Ride sharing is available only for point-to-point rides.',
            ], 422);
        }

        $result = app(RideEstimateService::class)->estimate(
            (float) $request->pickup_lat,
            (float) $request->pickup_lng,
            $request->dropoff_lat ? (float) $request->dropoff_lat : null,
            $request->dropoff_lng ? (float) $request->dropoff_lng : null,
            $request->service_type,
            $request->boolean('sharing_requested'),
            (int) $request->input('reserved_seats', 1),
            $request->input('vehicle_class', 'comfort')
        );

        if ($request->filled('coupon_code')) {
            $couponResult = app(CustomerCouponService::class)->preview(
                $request->user(),
                $request->input('coupon_code'),
                'ride',
                (float) $result['pricing']['subtotal']
            );

            $result['coupon'] = $this->formatCouponResult($couponResult);
            $result['pricing']['discount_amount'] = (float) $couponResult['discount_amount'];
            $result['pricing']['total'] = (float) $couponResult['final_amount'];
        }

        $fees = app(\App\Support\Pricing\PricingService::class)->applyFees(
            (float) $result['pricing']['subtotal'] - (float) ($result['pricing']['discount_amount'] ?? 0),
            ['lat' => (float) $request->pickup_lat, 'lng' => (float) $request->pickup_lng]
        );
        $result['pricing']['tax'] = $fees['tax'];
        $result['pricing']['service_fee'] = $fees['service_fee'];
        $result['pricing']['total'] = $fees['total'];

        return response()->json($result);
    }

    public function storeRide(Request $request)
    {
        $customer = $request->user();

        $validator = Validator::make($request->all(), [
            'service_type' => 'required|in:point_to_point,hourly,hourly_rental,round_trip',
            'pickup_location' => 'required|string|max:255',
            'pickup_lat' => 'required|numeric|between:-90,90',
            'pickup_lng' => 'required|numeric|between:-180,180',
            'dropoff_location' => 'nullable|string|max:255',
            'dropoff_lat' => 'nullable|numeric|between:-90,90',
            'dropoff_lng' => 'nullable|numeric|between:-180,180',
            'scheduled_at' => 'required|date|after:now',
            'request_mode' => 'sometimes|in:immediate,scheduled',
            'special_requests' => 'nullable|string',
            'payment_method' => 'required|in:cash,wallet',
            'coupon_code' => 'nullable|string|max:40',
            'sharing_requested' => 'sometimes|boolean',
            'reserved_seats' => 'sometimes|integer|min:1|max:3',
            'vehicle_class' => 'sometimes|in:mini,comfort,xl',
            'tour_id' => 'prohibited',
            'tour_schedule_id' => 'prohibited',
            'number_of_adults' => 'prohibited',
            'number_of_children' => 'prohibited',
            'car_category_id' => 'prohibited',
            'start_date' => 'prohibited',
            'end_date' => 'prohibited',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->boolean('sharing_requested') && $request->service_type !== 'point_to_point') {
            return response()->json([
                'success' => false,
                'message' => 'Ride sharing is available only for point-to-point rides.',
            ], 422);
        }

        $estimate = app(RideEstimateService::class)->estimate(
            (float) $request->pickup_lat,
            (float) $request->pickup_lng,
            $request->dropoff_lat ? (float) $request->dropoff_lat : null,
            $request->dropoff_lng ? (float) $request->dropoff_lng : null,
            $request->service_type,
            $request->boolean('sharing_requested'),
            (int) $request->input('reserved_seats', 1),
            $request->input('vehicle_class', 'comfort')
        );
        $couponResult = app(CustomerCouponService::class)->preview($customer, $request->input('coupon_code'), 'ride', (float) $estimate['pricing']['subtotal']);

        if ($request->filled('coupon_code') && ! $couponResult['eligible']) {
            return response()->json(['success' => false, 'message' => $couponResult['message']], 422);
        }

        try {
            $ride = DB::transaction(function () use ($request, $customer, $estimate, $couponResult) {
                \App\Models\Customer::whereKey($customer->id)->lockForUpdate()->firstOrFail();
                $activeRide = RideBooking::where('customer_id', $customer->id)
                    ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])
                    ->first();
                if ($activeRide) {
                    throw new \Illuminate\Http\Exceptions\HttpResponseException(response()->json(['success' => false, 'message' => 'Complete or cancel your active ride before starting another.', 'active_ride_id' => $activeRide->id], 409));
                }
                if ($request->input('request_mode') === 'immediate') {
                    RideBooking::where('customer_id', $customer->id)->whereNull('driver_id')->whereIn('status', ['pending', 'confirmed'])->whereNotNull('request_expires_at')->lockForUpdate()->get()->each(fn ($old) => app(\App\Services\RideRequestLifecycle::class)->close($old, 'superseded'));
                }
                $discountAmount = (float) ($couponResult['discount_amount'] ?? 0);
                $feePricing = app(\App\Support\Pricing\PricingService::class)->applyFees(
                    (float) $estimate['pricing']['subtotal'] - $discountAmount,
                    ['lat' => (float) $request->pickup_lat, 'lng' => (float) $request->pickup_lng]
                );
                $totalFare = $feePricing['total'];

                $ride = RideBooking::create([
                    'booking_number' => RideBooking::generateBookingNumber(),
                    'customer_id' => $customer->id,
                    'service_type' => $estimate['service_type'],
                    'ride_mode' => $estimate['sharing']['requested'] ? 'shared' : 'private',
                    'sharing_requested' => $estimate['sharing']['requested'],
                    'sharing_enabled_by' => $estimate['sharing']['enabled_by'],
                    'reserved_seats' => $estimate['sharing']['reserved_seats'],
                    'customer_name' => $customer->name,
                    'customer_email' => $customer->email,
                    'customer_phone' => $customer->phone,
                    'pickup_location' => $request->pickup_location,
                    'pickup_lat' => $request->pickup_lat,
                    'pickup_lng' => $request->pickup_lng,
                    'dropoff_location' => $request->dropoff_location,
                    'dropoff_lat' => $request->dropoff_lat,
                    'dropoff_lng' => $request->dropoff_lng,
                    'scheduled_at' => $request->scheduled_at,
                    'request_expires_at' => $request->input('request_mode') === 'immediate' ? now()->addSeconds(\App\Services\RideRequestLifecycle::SEARCH_SECONDS) : null,
                    'estimated_distance_km' => $estimate['estimated_distance_km'],
                    'estimated_duration' => $estimate['estimated_duration'],
                    'base_fare' => $estimate['pricing']['base_fare'],
                    'distance_fare' => $estimate['pricing']['distance_fare'],
                    'surge_multiplier' => $estimate['pricing']['surge_multiplier'],
                    'full_car_fare' => $estimate['pricing']['private_subtotal'],
                    'sharing_discount_percent' => $estimate['pricing']['sharing_discount_percent'],
                    'sharing_savings' => $estimate['pricing']['sharing_savings'],
                    'discount_amount' => $discountAmount,
                    'tax_amount' => $feePricing['tax'],
                    'service_fee_amount' => $feePricing['service_fee'],
                    'total_fare' => $totalFare,
                    'payment_method' => $request->payment_method,
                    'coupon_code' => $couponResult['eligible'] ? $couponResult['code'] : null,
                    'special_requests' => $request->special_requests,
                    'status' => 'pending',
                    'payment_status' => 'pending',
                ]);

                if ($couponResult['eligible'] && $couponResult['coupon']) {
                    app(CustomerCouponService::class)->redeem($customer, $couponResult['coupon'], $ride, 'ride', (float) $estimate['pricing']['subtotal'], $discountAmount);
                }

                // Handle Wallet Payment
                if ($request->payment_method === 'wallet') {
                    $wallet = Wallet::forOwner($customer)->first();
                    if (! $wallet || ! $wallet->hasSufficientBalance($totalFare)) {
                        throw new \RuntimeException('Insufficient wallet balance.');
                    }
                    $wallet->debit($totalFare, "Payment for Ride Booking #{$ride->id}", 'ride_booking', $ride->id);
                    $ride->update(['payment_status' => 'paid']);
                }

                return $ride;
            });
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $exception) {
            throw $exception;
        } catch (\RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        $dispatchService = app(DriverDispatchService::class);
        $deferredDispatch = $ride->scheduled_at->gt(now()->addMinutes((int) setting('ride.dispatch.window_minutes', 15)));
        $dispatchCandidates = $deferredDispatch ? collect() : $dispatchService->rankedCandidates(
            $estimate['ride_classification'],
            (float) $request->pickup_lat,
            (float) $request->pickup_lng,
            null,
            null,
            $ride->car_category_id ? (int) $ride->car_category_id : null,
            (bool) $ride->sharing_requested
        );
        $dispatchService->createRideAttempts($ride, $dispatchCandidates);
        $candidateDriverIds = $dispatchCandidates
            ->pluck('driver_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $ride->update([
            'dispatch_status' => $deferredDispatch ? 'pending' : (count($candidateDriverIds) > 0 ? 'offered' : 'admin_queue'),
            'admin_assignable' => ! $deferredDispatch && count($candidateDriverIds) === 0,
            'dispatch_failed_at' => count($candidateDriverIds) === 0 ? now() : null,
        ]);

        try {
            if (! $deferredDispatch) {
                broadcast(new NewRideRequest($ride, $candidateDriverIds));
            }
        } catch (\Throwable $e) {
            \Log::warning('Failed to broadcast NewRideRequest: '.$e->getMessage());
        }
        app(BookingLifecycleNotifier::class)->emit($ride->fresh('customer'), 'booking.created');
        if ($ride->payment_status === 'paid') {
            app(BookingLifecycleNotifier::class)->emit($ride->fresh('customer'), 'payment.paid');
        }

        return response()->json([
            'success' => true,
            'data' => $ride->load('driver:id,name,phone'),
            'receipt' => $this->formatBookingReceipt($ride, 'ride'),
            'dispatch' => [
                'classification' => $estimate['ride_classification'],
                'candidate_count' => count($candidateDriverIds),
                'candidate_driver_ids' => $candidateDriverIds,
                'admin_assignable' => (bool) $ride->admin_assignable,
                'dispatch_status' => $ride->dispatch_status,
            ],
            'sharing' => $estimate['sharing'],
            'fare_disclaimer' => $estimate['sharing']['requested'] ? 'You consent to sharing and receive a discounted rate. Pooling with another rider is not guaranteed.' : null,
        ], 201);
    }

    public function previewCoupon(Request $request)
    {
        $validated = $request->validate([
            'coupon_code' => 'required|string|max:40',
            'service_type' => 'required|in:ride,tour,rental',
            'subtotal' => 'required|numeric|min:0',
        ]);

        $result = app(CustomerCouponService::class)->preview(
            $request->user(),
            $validated['coupon_code'],
            $validated['service_type'],
            (float) $validated['subtotal']
        );

        return response()->json([
            'success' => (bool) $result['eligible'],
            'message' => $result['message'],
            'data' => $this->formatCouponResult($result),
        ], $result['eligible'] ? 200 : 422);
    }

    public function availableCoupons(Request $request)
    {
        $validated = $request->validate([
            'service_type' => 'required|in:ride,tour,rental',
            'subtotal' => 'required|numeric|min:0',
        ]);

        return response()->json([
            'success' => true,
            'data' => app(CustomerCouponService::class)->availableOffers(
                $request->user(),
                $validated['service_type'],
                (float) $validated['subtotal']
            ),
        ]);
    }

    public function addTourToWishlist(Request $request, $tourId)
    {
        $customer = $request->user();

        Wishlist::updateOrCreate(
            ['customer_id' => $customer->id, 'service_type' => 'tour', 'service_id' => (int) $tourId],
            ['customer_id' => $customer->id, 'service_type' => 'tour', 'service_id' => (int) $tourId]
        );

        return response()->json([
            'success' => true,
            'message' => 'Tour added to wishlist.',
        ]);
    }

    public function removeTourFromWishlist(Request $request, $tourId)
    {
        $customer = $request->user();

        Wishlist::where('customer_id', $customer->id)
            ->where('service_type', 'tour')
            ->where('service_id', (int) $tourId)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Tour removed from wishlist.',
        ]);
    }

    public function listWishlists(Request $request)
    {
        $customer = $request->user();

        $wishlistItems = Wishlist::where('customer_id', $customer->id)
            ->with(['tour' => function ($query) {
                $query->select('id', 'title', 'price', 'image', 'category');
            }])
            ->get();

        return response()->json([
            'success' => true,
            'data' => $wishlistItems->map(function ($item) {
                return [
                    'id' => $item->id,
                    'service_type' => $item->service_type,
                    'service_id' => $item->service_id,
                    'title' => $item->tour?->title,
                    'price' => $item->tour?->price,
                    'image' => $item->tour?->image,
                    'category' => $item->tour?->category,
                ];
            }),
        ]);
    }

    public function submitReview(Request $request, RideBooking $booking)
    {
        Gate::authorize('review', $booking);

        $validated = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);

        $review = RideBookingReview::updateOrCreate(
            [
                'ride_booking_id' => $booking->id,
                'customer_id' => $request->user()->id,
            ],
            [
                'driver_id' => $booking->driver_id,
                'driver_rating' => $validated['rating'],
                'review' => $validated['comment'] ?? null,
            ]
        );

        return response()->json([
            'success' => true,
            'data' => $review,
        ]);
    }

    public function cancelTour(Request $request, TourBooking $booking)
    {
        Gate::authorize('view', $booking);

        return $this->cancelCustomerBooking($request, $booking, 'tour');
    }

    public function submitTip(Request $request, RideBooking $booking)
    {
        Gate::authorize('tip', $booking);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:10|max:50000',
        ]);

        $customerWallet = Wallet::forOwner($request->user())->first();
        $driver = $booking->driver;
        $driverWallet = $driver ? Wallet::forOwner($driver)->firstOrCreate([
            'owner_type' => $driver::class,
            'owner_id' => $driver->id,
        ], [
            'balance' => 0,
            'currency' => 'INR',
            'status' => 'active',
        ]) : null;

        if (! $customerWallet || ! $driverWallet) {
            return response()->json([
                'success' => false,
                'message' => 'Wallet not available.',
            ], 422);
        }

        $amount = round((float) $validated['amount'], 2);

        DB::transaction(function () use ($customerWallet, $driverWallet, $booking, $amount, $request) {
            if (! $customerWallet->debit($amount, 'Tip paid for booking #'.$booking->booking_number, 'ride_tip_'.$booking->id)) {
                abort(422, 'Insufficient wallet balance.');
            }

            $driverWallet->credit($amount, 'Tip received for booking #'.$booking->booking_number, 'ride_tip_'.$booking->id);

            RideBookingTip::create([
                'ride_booking_id' => $booking->id,
                'customer_id' => $request->user()->id,
                'driver_id' => $booking->driver_id,
                'amount' => $amount,
                'payment_method' => 'wallet',
                'status' => 'paid',
            ]);
        });

        return response()->json([
            'success' => true,
        ]);
    }

    public function placeReviews(Place $place)
    {
        return response()->json([
            'success' => true,
            'data' => $place->reviews()->with('customer:id,name')->paginate(20),
        ]);
    }

    public function submitPlaceReview(Request $request, Place $place)
    {
        Gate::authorize('create', [PlaceReview::class, $place]);

        $validated = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'review' => 'nullable|string|max:1000',
        ]);

        $review = PlaceReview::updateOrCreate(
            ['place_id' => $place->id, 'customer_id' => $request->user()->id],
            $validated
        );

        $place->update([
            'rating' => round((float) $place->reviews()->avg('rating'), 2),
            'review_count' => $place->reviews()->count(),
        ]);

        return response()->json(['success' => true, 'data' => $review->load('customer:id,name')]);
    }

    public function submitTourReview(Request $request, TourBooking $booking)
    {
        Gate::authorize('review', $booking);

        $validated = $request->validate([
            'tour_rating' => 'required|integer|min:1|max:5',
            'driver_rating' => 'nullable|integer|min:1|max:5',
            'review' => 'nullable|string|max:1000',
        ]);

        $review = TourBookingReview::updateOrCreate(
            ['tour_booking_id' => $booking->id, 'customer_id' => $request->user()->id],
            array_merge($validated, ['driver_id' => $booking->assigned_driver_id])
        );

        return response()->json(['success' => true, 'data' => $review]);
    }

    public function submitRentalReview(Request $request, CarRental $rental)
    {
        Gate::authorize('review', $rental);

        $validated = $request->validate([
            'rental_rating' => 'required|integer|min:1|max:5',
            'driver_rating' => 'nullable|integer|min:1|max:5',
            'review' => 'nullable|string|max:1000',
        ]);

        $review = CarRentalReview::updateOrCreate(
            ['car_rental_id' => $rental->id, 'customer_id' => $request->user()->id],
            array_merge($validated, ['driver_id' => $rental->driver_id])
        );

        return response()->json(['success' => true, 'data' => $review]);
    }

    public function cancelPreviewRental(Request $request, CarRental $rental)
    {
        Gate::authorize('view', $rental);

        $preview = app(BookingCancellationService::class)->cancelPreview($rental, 'rental', 'customer');

        return response()->json([
            'success' => true,
            'data' => $preview,
        ]);
    }

    public function cancelRental(Request $request, CarRental $rental)
    {
        Gate::authorize('view', $rental);

        return $this->cancelCustomerBooking($request, $rental, 'rental');
    }

    public function storeSupportRequest(Request $request)
    {
        $validated = $request->validate([
            'service_type' => 'required|in:ride,tour,rental',
            'booking_id' => 'required|integer|min:1',
            'topic' => 'required|string|max:120',
            'details' => 'required|string|max:2000',
            'severity' => 'nullable|in:low,medium,high,critical',
        ]);

        $booking = match ($validated['service_type']) {
            'ride' => RideBooking::where('customer_id', $request->user()->id)->findOrFail($validated['booking_id']),
            'tour' => TourBooking::where('customer_id', $request->user()->id)->findOrFail($validated['booking_id']),
            'rental' => CarRental::where('customer_id', $request->user()->id)->findOrFail($validated['booking_id']),
        };

        $topic = strtolower($validated['topic']);
        $type = match (true) {
            str_contains($topic, 'payment') || str_contains($topic, 'wallet') => 'payment',
            str_contains($topic, 'cancel') || str_contains($topic, 'refund') => 'dispute',
            str_contains($topic, 'emergency') || str_contains($topic, 'safety') => 'safety',
            str_contains($topic, 'service') || str_contains($topic, 'active') => 'service_quality',
            default => 'other',
        };

        $incident = $booking->incidents()->create([
            'customer_id' => $request->user()->id,
            'driver_id' => $booking->driver_id ?? $booking->assigned_driver_id ?? null,
            'opened_by_type' => get_class($request->user()),
            'opened_by_id' => $request->user()->id,
            'type' => $type,
            'severity' => $validated['severity'] ?? 'medium',
            'status' => 'open',
            'title' => $validated['topic'],
            'description' => $validated['details'],
            'reported_at' => now(),
        ]);

        app(BookingLifecycleNotifier::class)->emit($booking->fresh('customer'), 'support.updated');

        return response()->json([
            'success' => true,
            'message' => 'Support request submitted successfully.',
            'data' => $incident,
        ], 201);
    }

    public function rideNextSteps(Request $request, int $booking)
    {
        $ride = RideBooking::where('customer_id', $request->user()->id)->findOrFail($booking);

        return $this->bookingNextStepsResponse($ride, 'ride');
    }

    public function tourNextSteps(Request $request, int $booking)
    {
        $tour = TourBooking::with('tour:id,title,start_location,end_location')
            ->where('customer_id', $request->user()->id)
            ->findOrFail($booking);

        return $this->bookingNextStepsResponse($tour, 'tour');
    }

    public function rentalNextSteps(Request $request, int $booking)
    {
        $rental = CarRental::with('carCategory:id,name')
            ->where('customer_id', $request->user()->id)
            ->findOrFail($booking);

        return $this->bookingNextStepsResponse($rental, 'rental');
    }

    private function bookingNextStepsResponse(RideBooking|TourBooking|CarRental $model, string $serviceType)
    {
        $verification = app(StartVerificationService::class);

        return response()->json([
            'success' => true,
            'data' => [
                'mock_payments_enabled' => app()->environment('local', 'testing') && config('services.testing.mock_payments'),
                'total' => $model->total_fare ?? $model->total_price,
                'service_type' => $serviceType,
                'booking_id' => $model->id,
                'booking_number' => $model->booking_number,
                'status' => $model->status,
                'payment_status' => $model->payment_status,
                'tracking_url' => "/tracking?kind={$serviceType}&id={$model->id}",
                'start_verification' => [
                    'required' => true,
                    'code' => $verification->codeFor($model, $serviceType),
                    'verified' => $verification->isVerified($model),
                ],
                'instructions' => $this->nextStepInstructions($model, $serviceType),
                'actions' => [
                    'can_check_in' => in_array($model->status, ['confirmed', 'driver_assigned', 'pickup', 'in_progress', 'in_transit'], true) && ! $verification->isVerified($model),
                    'can_cancel' => in_array($model->status, ['pending', 'confirmed', 'driver_assigned'], true),
                    'can_track' => true,
                    'can_contact_support' => true,
                    'can_review' => $model->status === 'completed',
                ],
            ],
        ]);
    }

    public function rideCheckIn(Request $request, int $booking)
    {
        $ride = RideBooking::where('customer_id', $request->user()->id)->findOrFail($booking);

        return $this->recordBookingCheckIn($request, $ride, 'ride');
    }

    public function tourCheckIn(Request $request, int $booking)
    {
        $tour = TourBooking::where('customer_id', $request->user()->id)->findOrFail($booking);

        return $this->recordBookingCheckIn($request, $tour, 'tour');
    }

    public function rentalCheckIn(Request $request, int $booking)
    {
        $rental = CarRental::where('customer_id', $request->user()->id)->findOrFail($booking);

        return $this->recordBookingCheckIn($request, $rental, 'rental');
    }

    private function recordBookingCheckIn(
        Request $request,
        RideBooking|TourBooking|CarRental $model,
        string $serviceType
    ) {
        if (in_array($model->status, ['completed', 'cancelled'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Completed or cancelled bookings cannot be checked in.',
            ], 422);
        }

        $validated = $request->validate([
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'note' => 'nullable|string|max:500',
        ]);

        $audit = app(StartVerificationService::class)->checkIn($model, $request->user(), $validated);
        app(BookingLifecycleNotifier::class)->emit($model->fresh('customer'), 'booking.started', [
            'actor' => 'customer',
            'check_in_id' => $audit->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Customer check-in recorded. Share the start OTP with the assigned operator at pickup/handover.',
            'data' => [
                'check_in' => $audit,
                'next_steps' => $this->nextStepInstructions($model->fresh(), $serviceType),
            ],
        ]);
    }

    private function discardPrePickupPointRide(Request $request, RideBooking $booking)
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:1000',
        ]);

        $discarded = DB::transaction(function () use ($booking) {
            $locked = RideBooking::query()->lockForUpdate()->find($booking->getKey());

            if (! $locked || $locked->driver_id || $locked->payment_status === 'paid' || ! $locked->isPrePickupPointRide()) {
                return null;
            }

            $previousStatus = $locked->status;
            $refundAmount = 0.0;

            foreach ($locked->couponRedemptions()->get() as $redemption) {
                CustomerCoupon::query()
                    ->whereKey($redemption->customer_coupon_id)
                    ->where('used_count', '>', 0)
                    ->decrement('used_count');
                $redemption->delete();
            }

            $locked->incidents()->delete();
            $locked->auditLogs()->delete();
            $locked->refunds()->delete();

            if ($locked->payment_status === 'paid' && $locked->payment_method === 'wallet') {
                $refundAmount = (float) $locked->total_fare;
                $wallet = Wallet::forOwner($locked->customer)->lockForUpdate()->first();

                if ($wallet && $refundAmount > 0) {
                    $wallet->credit(
                        $refundAmount,
                        'Refund for cancelled point ride',
                        'ride_booking',
                        (string) $locked->id,
                        "point-ride-cancel-{$locked->id}"
                    );
                }
            }

            $locked->delete();

            return [
                'ride' => $locked,
                'previous_status' => $previousStatus,
                'refund_amount' => $refundAmount,
            ];
        });

        if (! $discarded) {
            return $this->cancelCustomerBooking($request, $booking->fresh(), 'ride');
        }

        $ride = $discarded['ride'];
        if ($ride->driver_id) {
            DriverAvailability::where('driver_id', $ride->driver_id)->update([
                'is_available' => true,
                'status' => 'online',
                'last_updated' => now(),
            ]);
        }

        broadcast(new RideStatusUpdated(
            $ride,
            'cancelled',
            $validated['reason'] ?? 'Ride request cancelled by customer.',
            $discarded['previous_status']
        ));

        return response()->json([
            'success' => true,
            'message' => 'Point ride request cancelled and removed.',
            'data' => [
                'id' => $ride->id,
                'removed' => true,
                'refund_amount' => $discarded['refund_amount'],
            ],
        ]);
    }

    private function cancelCustomerBooking(Request $request, RideBooking|TourBooking|CarRental $booking, string $serviceType)
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:1000',
        ]);

        if (in_array($booking->status, ['completed', 'cancelled'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Completed or cancelled bookings cannot be cancelled again.',
            ], 422);
        }

        $refund = app(BookingCancellationService::class)->cancel(
            $booking,
            $serviceType,
            $validated['reason'] ?? null
        );

        $booking->refresh();
        if ($refund && $refund->status === 'processed') {
            app(BookingLifecycleNotifier::class)->emit($booking->fresh('customer'), 'refund.processed');
        }

        return response()->json([
            'success' => true,
            'message' => 'Booking cancelled successfully.',
            'data' => [
                'booking' => $booking,
                'refund' => $refund,
                'receipt' => $this->formatBookingReceipt($booking, $serviceType, $refund),
            ],
        ]);
    }

    private function nextStepInstructions(RideBooking|TourBooking|CarRental $booking, string $serviceType): array
    {
        if ($booking->status === 'completed') {
            return [
                'Service is completed.',
                'Rate the service and add a tip or review if you want.',
                'Contact support from the booking if any receipt, refund, or claim detail looks wrong.',
            ];
        }

        if ($booking->status === 'cancelled') {
            return [
                'Booking is cancelled.',
                'Track refund state from the receipt or wallet.',
                'Contact support if the cancellation reason or refund amount needs review.',
            ];
        }

        $payment = $booking->payment_status === 'paid'
            ? 'Payment is already recorded.'
            : 'Payment can be completed now or settled later according to the selected method.';

        return match ($serviceType) {
            'ride' => [
                $payment,
                'Keep pickup notes and phone reachable for driver assignment.',
                'When the driver arrives, share the start OTP shown on tracking.',
                'Track driver location and ETA from the live tracking screen.',
            ],
            'tour' => [
                $payment,
                'Review schedule, pickup option, participants, and inclusions before travel.',
                'At guide/driver check-in, share the tour start OTP and press customer check-in.',
                'Track tour status, current stop, weather, support, and rating from tracking.',
            ],
            'rental' => [
                $payment,
                'Carry ID and inspect vehicle condition/features at handover.',
                'At handover, share the rental start OTP and press customer check-in.',
                'Track rental location, roadside care, insurance, and return steps from tracking.',
            ],
            default => [],
        };
    }

    private function appendStructuredNotes(?string $notes, array $metadata): ?string
    {
        $lines = collect([$notes])
            ->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->map(fn ($value) => trim((string) $value));

        foreach ($metadata as $key => $value) {
            if ($value === null || $value === false || $value === [] || $value === '') {
                continue;
            }

            $formatted = is_array($value) ? implode(', ', array_filter($value)) : (string) $value;
            if ($formatted !== '') {
                $lines->push(str_replace('_', ' ', ucfirst($key)).': '.$formatted);
            }
        }

        return $lines->isEmpty() ? null : $lines->join("\n");
    }

    private function formatCouponResult(array $result): array
    {
        return [
            'eligible' => (bool) ($result['eligible'] ?? false),
            'code' => $result['code'] ?? null,
            'name' => $result['name'] ?? null,
            'description' => $result['description'] ?? null,
            'service_type' => $result['service_type'] ?? null,
            'subtotal' => (float) ($result['subtotal'] ?? 0),
            'discount_amount' => (float) ($result['discount_amount'] ?? 0),
            'final_amount' => (float) ($result['final_amount'] ?? 0),
            'message' => $result['message'] ?? null,
        ];
    }

    private function formatBookingReceipt(RideBooking|TourBooking|CarRental $booking, string $serviceType, mixed $refund = null): array
    {
        return (new BookingReceiptResource($booking, $serviceType, $refund))->resolve(request());
    }

    private function formatPlaceDetails(Place $place): array
    {
        return (new PlaceDetailResource($place, $this->relatedToursForPlace($place)))->resolve(request());
    }

    private function formatPublicPlaceSummary(Place $place): array
    {
        return (new PlaceSummaryResource($place))->resolve(request());
    }

    private function formatPublicCarCategory(CarCategory $category): array
    {
        $images = collect($category->images ?? [])
            ->map(fn ($image) => MediaUrl::resolve($image))
            ->filter()
            ->values()
            ->all();

        return [
            ...$category->toArray(),
            'images' => $images,
            'cover_image' => $images[0] ?? null,
            'capacity' => (int) $category->seats,
            'base_fare' => (float) $category->base_price_per_day,
            'per_km_fare' => (float) $category->price_per_km,
        ];
    }

    private function rentableVehicles()
    {
        return Vehicle::query()
            ->with(['category', 'driver:id,name,rating,status,is_active,is_approved,can_rental_delivery'])
            ->where('is_available_for_rent', true)
            ->where('is_active', true)
            ->where('approval_status', 'approved')
            ->where(fn ($query) => $query
                ->whereNull('condition')
                ->orWhere('condition', '!=', 'under_maintenance'))
            ->whereHas('category', fn ($query) => $query->where('is_active', true))
            ->whereHas('driver', fn ($query) => $query
                ->where('status', 'active')
                ->where('is_active', true)
                ->where('is_approved', true)
                ->where('can_rental_delivery', true));
    }

    private function formatPublicRentalVehicle(Vehicle $vehicle): array
    {
        $category = $vehicle->category;
        $images = collect($category?->images ?? [])
            ->map(fn ($image) => MediaUrl::resolve($image))
            ->filter()
            ->values()
            ->all();

        return [
            'id' => $vehicle->id,
            'registration_number' => $vehicle->registration_number,
            'make' => $vehicle->make,
            'model' => $vehicle->model,
            'year' => (int) $vehicle->year,
            'color' => $vehicle->color,
            'fuel_type' => $vehicle->fuel_type,
            'seats' => (int) $vehicle->seats,
            'is_ac' => (bool) $vehicle->is_ac,
            'condition' => $vehicle->condition,
            'category' => $category ? $this->formatPublicCarCategory($category) : null,
            'driver' => $vehicle->driver ? [
                'name' => $vehicle->driver->name,
                'rating' => (float) ($vehicle->driver->rating ?? 0),
            ] : null,
            'images' => $images,
            'cover_image' => $images[0] ?? null,
            'base_fare' => (float) ($category?->base_price_per_day ?? 0),
            'extra_km_charge' => (float) ($category?->extra_km_charge ?? 0),
        ];
    }

    private function formatPublicTour(Tour $tour, bool $includePlaces = false): array
    {
        return (new TourResource($tour))
            ->withRelatedPlaces($includePlaces ? $this->relatedPlacesForTour($tour) : null)
            ->resolve(request());
    }

    private function relatedToursForPlace(Place $place)
    {
        return app(\App\Services\TourSearchService::class)
            ->query(['destination_id' => $place->id, 'sort' => 'departure'])
            ->with(['itineraries.place.media' => fn ($query) => $query->approved()])
            ->limit(6)
            ->get();
    }

    private function relatedPlacesForTour(Tour $tour)
    {
        $terms = collect([
            $tour->title,
            $tour->description,
            $tour->short_description,
            $tour->start_location,
            $tour->end_location,
            $tour->region,
            ...($tour->highlights ?? []),
            ...$tour->itineraries->flatMap(fn ($itinerary) => [
                $itinerary->title,
                $itinerary->description,
                ...($itinerary->activities ?? []),
            ])->all(),
        ])
            ->filter()
            ->map(fn ($term) => Str::lower((string) $term))
            ->join(' ');

        if (! $terms) {
            return collect();
        }

        $explicitPlaceIds = $tour->itineraries
            ->pluck('place_id')
            ->filter()
            ->unique()
            ->values();

        if ($explicitPlaceIds->isNotEmpty()) {
            return Place::with(['media' => fn ($query) => $query->approved()])
                ->whereIn('id', $explicitPlaceIds)
                ->where('is_active', true)
                ->get()
                ->values();
        }

        return Place::with(['media' => fn ($query) => $query->approved()])
            ->where('is_active', true)
            ->get()
            ->filter(function (Place $place) use ($terms) {
                $placeTerms = collect([
                    $place->name,
                    $place->slug,
                    $place->location,
                    $place->city,
                    $place->state,
                    ...($place->tags ?? []),
                ])
                    ->filter()
                    ->map(fn ($term) => Str::lower((string) $term))
                    ->filter(fn ($term) => Str::length($term) > 2);

                return $placeTerms->contains(fn ($term) => Str::contains($terms, $term));
            })
            ->values();
    }

    public function submitTourInquiry(Request $request)
    {
        $validated = $request->validate([
            'tour_id' => 'required|exists:tours,id',
            'tour_schedule_id' => 'nullable|exists:tour_schedules,id',
            'inquiry_type' => 'required|in:sold_out_waitlist,private_tour_request',
            'desired_date' => 'nullable|date_format:Y-m-d|after_or_equal:today',
            'number_of_guests' => 'nullable|integer|min:1|max:100',
            'customer_name' => 'nullable|string|max:120',
            'customer_phone' => 'nullable|string|max:20',
            'customer_email' => 'nullable|email|max:120',
            'special_requests' => 'nullable|string|max:1000',
        ]);

        $customer = $request->user();
        $waitlistService = app(\App\Services\TourWaitlistService::class);

        $inquiry = $validated['inquiry_type'] === \App\Models\TourInquiry::TYPE_SOLD_OUT_WAITLIST
            ? $waitlistService->joinWaitlist($customer, $validated)
            : $waitlistService->requestPrivateTour($customer, $validated);

        return response()->json([
            'success' => true,
            'message' => $inquiry->inquiry_type === \App\Models\TourInquiry::TYPE_SOLD_OUT_WAITLIST
                ? 'You have been added to the waitlist. We will notify you if seats become available.'
                : 'Your private tour request has been submitted. Our operator will reach out shortly.',
            'data' => $inquiry->load(['tour:id,title,slug', 'schedule:id,departure_date,departure_time']),
        ], 201);
    }

    public function customerTourInquiries(Request $request)
    {
        $inquiries = \App\Models\TourInquiry::with(['tour:id,title,slug', 'schedule:id,departure_date,departure_time'])
            ->where('customer_id', $request->user()->id)
            ->latest()
            ->paginate($request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $inquiries->items(),
            'pagination' => [
                'current_page' => $inquiries->currentPage(),
                'last_page' => $inquiries->lastPage(),
                'total' => $inquiries->total(),
            ],
        ]);
    }

    public function cancelTourInquiry(Request $request, \App\Models\TourInquiry $inquiry)
    {
        abort_unless((int) $inquiry->customer_id === (int) $request->user()->id, 403, 'Unauthorized.');

        if ($inquiry->status === \App\Models\TourInquiry::STATUS_PENDING) {
            $inquiry->update(['status' => \App\Models\TourInquiry::STATUS_CANCELLED]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Tour inquiry cancelled successfully.',
            'data' => $inquiry->fresh(),
        ]);
    }
}

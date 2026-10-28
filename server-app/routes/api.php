<?php

use App\Http\Controllers\AdminCustomerController;
use App\Http\Controllers\AdminDriverController;
use App\Http\Controllers\Api\CmsController;
use App\Http\Controllers\Api\CustomerAppController;
use App\Http\Controllers\Api\CustomerOtpController;
use App\Http\Controllers\Api\DriverAppController;
use App\Http\Controllers\Api\DriverController;
use App\Http\Controllers\Api\DriverOtpController;
use App\Http\Controllers\Api\InsuranceController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\LoyaltyController;
use App\Http\Controllers\Api\SupportTicketController;
use App\Http\Controllers\Api\TrackingController;
use App\Http\Controllers\Api\V1\BookingReceiptController;
use App\Http\Controllers\Api\V1\MetaController;
use App\Http\Controllers\Api\VehicleTrackerController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\WishlistController;
use App\Http\Controllers\Api\WithdrawalController;
use Illuminate\Support\Facades\Route;

require __DIR__.'/carpool.php';

Route::post('/razorpay/webhook', [WalletController::class, 'handleRazorpayWebhook']);
Route::post('/tracker/v1/location', [VehicleTrackerController::class, 'location'])
    ->middleware('throttle:240,1');
Route::get('/cms/{app}', [CmsController::class, 'show'])->where('app', '[a-z0-9-]+');

/*
|--------------------------------------------------------------------------
| Versioned API (v1) — strict response contract (SKY-MRD-001 §9)
|--------------------------------------------------------------------------
| New surface built on App\Support\ApiResponse: {success, data|error, meta}.
| Legacy prefixes below keep their historical shapes for the frozen clients.
*/
Route::prefix('v1')->group(function () {
    Route::get('/meta', [MetaController::class, 'show']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/bookings/{booking}/receipt', [BookingReceiptController::class, 'show']);
    });
});

/*
|--------------------------------------------------------------------------
| Customer App Routes
|--------------------------------------------------------------------------
*/
Route::prefix('customer-app')->group(function () {
    // Public routes
    Route::get('/public/cms/{app}', [CmsController::class, 'show'])->where('app', '[a-z0-9-]+');
    Route::get('/public/bootstrap', [CustomerAppController::class, 'publicBootstrap']);
    Route::get('/public/tours', [CustomerAppController::class, 'publicTours']);
    Route::get('/public/tours/{tour}', [CustomerAppController::class, 'publicTour']);
    Route::get('/public/tours/{tour}/brochure', [\App\Http\Controllers\TourBrochureController::class, 'publicDownload'])
        ->middleware('throttle:30,1')->name('public.tours.brochure');
    Route::get('/public/tours/{tour}/schedules', [CustomerAppController::class, 'tourSchedules']);
    Route::get('/public/destinations', [CustomerAppController::class, 'publicDestinations']);
    Route::get('/public/destinations/{place}', [CustomerAppController::class, 'publicDestination']);
    Route::get('/public/google-place-photo', [CustomerAppController::class, 'publicGooglePlacePhoto'])
        ->middleware(['signed', 'throttle:120,1'])
        ->name('customer-app.google-place-photo');
    Route::get('/public/places', [CustomerAppController::class, 'publicPlaces']);
    Route::get('/public/places/popular', [CustomerAppController::class, 'publicPopularPlaces']);
    Route::get('/public/places/{place}', [CustomerAppController::class, 'publicDestination']);
    Route::get('/public/car-categories', [CustomerAppController::class, 'publicCarCategories']);
    Route::get('/public/car-categories/{carCategory}', [CustomerAppController::class, 'publicCarCategory']);
    Route::get('/public/rental-vehicles', [CustomerAppController::class, 'publicRentalVehicles']);
    Route::get('/public/rental-vehicles/{vehicle}', [CustomerAppController::class, 'publicRentalVehicle']);
    Route::post('/public/directions', [LocationController::class, 'directions'])->middleware('throttle:60,1');
    Route::get('/public/locations/search', [LocationController::class, 'search']);
    Route::get('/public/locations/popular', [LocationController::class, 'popular']);
    Route::post('/public/locations/validate', [LocationController::class, 'validateLocation']);
    Route::get('/public/locations/place-details', [LocationController::class, 'placeDetails']);
    Route::match(['get', 'post'], '/public/rides/estimate', [CustomerAppController::class, 'estimateRide']);
    Route::post('/public/newsletter/subscribe', [CustomerAppController::class, 'subscribeNewsletter']);
    Route::post('/public/wishlists/tours/{tourId}/{action}', [WishlistController::class, 'toggleTour']);
    Route::get('/public/coupons/deals', [LoyaltyController::class, 'publicDeals']);

    Route::post('/otp/send', [CustomerOtpController::class, 'sendOtp'])->middleware('throttle:otp-send');
    Route::post('/otp/verify', [CustomerOtpController::class, 'verifyOtp'])->middleware('throttle:otp-verify');
    Route::post('/otp/register-complete', [CustomerOtpController::class, 'completeRegistration'])->middleware('throttle:otp-verify');

    Route::post('/tour-shares/otp', [\App\Http\Controllers\Api\TourShareController::class, 'sendOtp'])->middleware('throttle:10,1');
    Route::post('/tour-shares/verify', [\App\Http\Controllers\Api\TourShareController::class, 'verify'])->middleware('throttle:20,1');
    Route::get('/tour-shares/view', [\App\Http\Controllers\Api\TourShareController::class, 'show'])->middleware('throttle:60,1');

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/tour-bookings/{booking}/shares', [\App\Http\Controllers\Api\TourShareController::class, 'index']);
        Route::post('/tour-bookings/{booking}/shares', [\App\Http\Controllers\Api\TourShareController::class, 'store'])->middleware('throttle:customer-write');
        Route::delete('/tour-bookings/{booking}/shares/{share}', [\App\Http\Controllers\Api\TourShareController::class, 'revoke'])->middleware('throttle:customer-write');
        Route::post('/tours/quote', [CustomerAppController::class, 'bookTour'])->middleware('throttle:customer-write');
        Route::post('/rentals/quote', [CustomerAppController::class, 'bookCar'])->middleware('throttle:customer-write');
        Route::post('/mock-payments/{kind}/{id}', [\App\Http\Controllers\Api\MockPaymentController::class, 'store'])->middleware(['throttle:payment-write', 'idempotency']);
        Route::get('/booking-payments/{kind}/{id}', [\App\Http\Controllers\Api\BookingPaymentController::class, 'show'])->where(['kind' => 'ride|tour|rental', 'id' => '[0-9]+']);
        Route::post('/booking-payments/{kind}/{id}/order', [\App\Http\Controllers\Api\BookingPaymentController::class, 'store'])->where(['kind' => 'ride|tour|rental', 'id' => '[0-9]+'])->middleware('throttle:payment-write');
        Route::post('/booking-payments/{kind}/{id}/verify', [\App\Http\Controllers\Api\BookingPaymentController::class, 'verify'])->where(['kind' => 'ride|tour|rental', 'id' => '[0-9]+'])->middleware('throttle:payment-write');
        Route::get('/wishlists', [WishlistController::class, 'index']);
        Route::post('/wishlists/toggle', [WishlistController::class, 'toggle'])->middleware('throttle:customer-write');
        Route::post('/wishlists/tours/{tourId}/{action}', [WishlistController::class, 'toggleTour'])->middleware('throttle:customer-write');
        Route::post('/wishlists/sync', [WishlistController::class, 'sync'])->middleware('throttle:customer-write');
        Route::get('/loyalty', [LoyaltyController::class, 'index']);
        Route::get('/referrals', [LoyaltyController::class, 'referralDetails']);
        Route::post('/logout', [CustomerOtpController::class, 'logout']);
        Route::get('/me', [CustomerOtpController::class, 'me']);
        Route::match(['put', 'patch', 'post'], '/profile', [CustomerOtpController::class, 'updateProfile'])->middleware('throttle:customer-write');
        Route::post('/profile/photo', [CustomerOtpController::class, 'uploadProfilePhoto'])->middleware('throttle:customer-write');
        Route::get('/dashboard', [CustomerAppController::class, 'dashboard']);
        Route::post('/coupons/preview', [CustomerAppController::class, 'previewCoupon'])->middleware('throttle:customer-write');
        Route::get('/coupons/available', [CustomerAppController::class, 'availableCoupons']);
        Route::get('/tours', [CustomerAppController::class, 'tours']);
        Route::get('/tour-schedules/{tour}', [CustomerAppController::class, 'tourSchedules']);
        Route::get('/tour-bookings', [CustomerAppController::class, 'tourBookings']);
        Route::post('/tours/book', [CustomerAppController::class, 'bookTour'])->middleware(['throttle:customer-write', 'idempotency']);
        Route::post('/tours/inquiry', [CustomerAppController::class, 'submitTourInquiry'])->middleware('throttle:customer-write');
        Route::get('/tour-inquiries', [CustomerAppController::class, 'customerTourInquiries']);
        Route::delete('/tour-inquiries/{inquiry}', [CustomerAppController::class, 'cancelTourInquiry'])->middleware('throttle:customer-write');
        Route::get('/car-categories', [CustomerAppController::class, 'carCategories']);
        Route::get('/car-rentals', [CustomerAppController::class, 'carRentals']);
        Route::post('/car-rentals', [CustomerAppController::class, 'bookCar'])->middleware(['throttle:customer-write', 'idempotency']);
        Route::get('/car-rentals/{rental}/cancel-preview', [CustomerAppController::class, 'cancelPreviewRental']);
        Route::post('/car-rentals/{rental}/cancel', [CustomerAppController::class, 'cancelRental'])->middleware('throttle:customer-write');
        Route::post('/car-rentals/{rental}/review', [CustomerAppController::class, 'submitRentalReview'])->middleware('throttle:customer-write');
        Route::get('/rides', [CustomerAppController::class, 'rides']);
        Route::get('/rides/current', [CustomerAppController::class, 'currentRide']);
        Route::get('/rides/{booking}', [CustomerAppController::class, 'showRide']);
        Route::post('/rides/estimate', [CustomerAppController::class, 'estimateRide'])->middleware('throttle:customer-write');
        Route::post('/rides', [CustomerAppController::class, 'storeRide'])->middleware(['throttle:customer-write', 'idempotency']);
        Route::post('/shared-rides/search', [\App\Http\Controllers\Api\SharedTripController::class, 'search'])->middleware('throttle:30,1');
        Route::put('/rides/{booking}/sharing', [\App\Http\Controllers\Api\SharedTripController::class, 'preference'])->middleware('throttle:customer-write');
        Route::post('/shared-rides/join', [\App\Http\Controllers\Api\SharedTripController::class, 'join'])->middleware(['throttle:customer-write', 'idempotency']);
        Route::post('/rides/{booking}/cancel', [CustomerAppController::class, 'cancelRide'])->middleware('throttle:customer-write');
        Route::post('/rides/{booking}/review', [CustomerAppController::class, 'submitReview'])->middleware('throttle:customer-write');
        Route::post('/rides/{booking}/tip', [CustomerAppController::class, 'submitTip'])->middleware(['throttle:payment-write', 'idempotency']);
        Route::get('/places/{place}/reviews', [CustomerAppController::class, 'placeReviews']);
        Route::post('/places/{place}/reviews', [CustomerAppController::class, 'submitPlaceReview'])->middleware('throttle:customer-write');
        Route::post('/places/{place}/media', [CustomerAppController::class, 'uploadPlaceMedia'])->middleware('throttle:customer-write');
        Route::post('/tour-bookings/{booking}/cancel', [CustomerAppController::class, 'cancelTour'])->middleware('throttle:customer-write');
        Route::post('/tour-bookings/{booking}/review', [CustomerAppController::class, 'submitTourReview'])->middleware('throttle:customer-write');
        Route::get('/support/tickets', [SupportTicketController::class, 'index']);
        Route::get('/tour-shares/invitations', [\App\Http\Controllers\Api\TourShareController::class, 'invitations']);
        Route::post('/support/tickets', [SupportTicketController::class, 'store'])->middleware('throttle:support-write');
        Route::post('/support/tickets/{ticket}/messages', [SupportTicketController::class, 'reply'])->middleware('throttle:support-write');
        Route::post('/support/requests', [CustomerAppController::class, 'storeSupportRequest'])->middleware('throttle:support-write');
        Route::get('/rides/{booking}/next-steps', [CustomerAppController::class, 'rideNextSteps']);
        Route::post('/rides/{booking}/check-in', [CustomerAppController::class, 'rideCheckIn'])->middleware('throttle:customer-write');
        Route::get('/tour-bookings/{booking}/next-steps', [CustomerAppController::class, 'tourNextSteps']);
        Route::post('/tour-bookings/{booking}/check-in', [CustomerAppController::class, 'tourCheckIn'])->middleware('throttle:customer-write');
        Route::get('/car-rentals/{booking}/next-steps', [CustomerAppController::class, 'rentalNextSteps']);
        Route::post('/car-rentals/{booking}/check-in', [CustomerAppController::class, 'rentalCheckIn'])->middleware('throttle:customer-write');
        Route::get('/tracking/ride/{booking}', [TrackingController::class, 'getTrackingInfo']);
        Route::get('/tracking/tour/{booking}', [TrackingController::class, 'getTourTrackingInfo']);
        Route::get('/tracking/rental/{rental}', [TrackingController::class, 'getRentalTrackingInfo']);
        Route::get('/wallet', [WalletController::class, 'getWallet']);
        Route::get('/wallet/transactions', [WalletController::class, 'getTransactions']);
        Route::post('/wallet/topup/order', [WalletController::class, 'createTopUpOrder'])->middleware(['throttle:payment-write', 'idempotency']);
        Route::post('/wallet/topup/verify', [WalletController::class, 'verifyTopUp'])->middleware(['throttle:payment-write', 'idempotency']);
        Route::get('/insurance/plans', [InsuranceController::class, 'getPlans']);
        Route::get('/insurance/policies', [InsuranceController::class, 'getPolicies']);
        Route::get('/insurance/policies/{id}', [InsuranceController::class, 'getPolicy']);
        Route::post('/insurance/policies', [InsuranceController::class, 'createPolicy'])->middleware('throttle:customer-write');
        Route::put('/insurance/policies/{id}', [InsuranceController::class, 'updatePolicy'])->middleware('throttle:customer-write');
        Route::delete('/insurance/policies/{id}', [InsuranceController::class, 'cancelPolicy'])->middleware('throttle:customer-write');
        Route::get('/insurance/claims', [InsuranceController::class, 'getClaims']);
        Route::post('/insurance/claims', [InsuranceController::class, 'createClaim'])->middleware(['throttle:support-write', 'idempotency']);
        Route::get('/insurance/extended-care', [InsuranceController::class, 'getExtendedCare']);
        Route::post('/insurance/extended-care', [InsuranceController::class, 'requestAssistance'])->middleware('throttle:support-write');
        Route::delete('/insurance/extended-care/{id}', [InsuranceController::class, 'cancelAssistance'])->middleware('throttle:customer-write');
    });
});

/*
|--------------------------------------------------------------------------
| Driver App Routes
|--------------------------------------------------------------------------
*/
Route::prefix('driver-app')->group(function () {
    Route::get('/public/cms/{app}', [CmsController::class, 'show'])->where('app', '[a-z0-9-]+');
    // OTP Auth routes
    Route::post('/otp/send', [DriverOtpController::class, 'sendOtp'])->middleware('throttle:otp-send');
    Route::post('/otp/verify', [DriverOtpController::class, 'verifyOtp'])->middleware('throttle:otp-verify');
    Route::post('/otp/register-complete', [DriverOtpController::class, 'completeRegistration'])->middleware('throttle:otp-verify');

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [DriverOtpController::class, 'logout']);
        Route::get('/me', [DriverOtpController::class, 'me']);
        Route::get('/dashboard', [DriverAppController::class, 'dashboard']);
        Route::get('/history', [DriverAppController::class, 'history']);
        Route::get('/history/{kind}/{id}', [DriverAppController::class, 'historyDetail'])
            ->whereIn('kind', ['ride', 'tour', 'rental'])
            ->whereNumber('id');
        Route::get('/vehicle', [DriverAppController::class, 'vehicle']);
        Route::get('/documents', [DriverAppController::class, 'documents']);
        Route::post('/documents/{document}/appeal', [\App\Http\Controllers\VerificationController::class, 'appeal'])->middleware('throttle:customer-write');
        Route::get('/verification-notices', [\App\Http\Controllers\VerificationController::class, 'notices']);
        Route::post('/verification-notices/{notice}/read', [\App\Http\Controllers\VerificationController::class, 'readNotice']);
        Route::post('/documents', [DriverAppController::class, 'upsertDocument'])->middleware('throttle:customer-write');
        Route::get('/insurance/policies', [InsuranceController::class, 'getDriverPolicies']);
        Route::match(['put', 'post'], '/vehicle', [DriverAppController::class, 'upsertVehicle'])->middleware('throttle:customer-write');
        Route::put('/vehicle/rental-availability', [DriverAppController::class, 'updateRentalAvailability'])->middleware('throttle:customer-write');
        Route::put('/availability', [DriverAppController::class, 'updateAvailability'])->middleware('throttle:customer-write');
        Route::get('/active-ride', [DriverController::class, 'activeRide']);
        Route::post('/rides/{booking}/pooling', [\App\Http\Controllers\Api\SharedTripController::class, 'open'])->middleware('throttle:customer-write');
        Route::post('/directions', [LocationController::class, 'directions'])->middleware('throttle:60,1');
        Route::get('/active-rental', [DriverAppController::class, 'activeRental']);
        Route::get('/pending-rides', [DriverController::class, 'pendingRides']);
        Route::post('/rides/{booking}/accept', [DriverController::class, 'acceptRide'])->middleware('throttle:customer-write');
        Route::post('/rides/{booking}/decline', [DriverController::class, 'declineRide'])->middleware('throttle:customer-write');
        Route::post('/rides/{booking}/cancel', [DriverController::class, 'cancelRide'])->middleware('throttle:customer-write');
        Route::post('/rides/{booking}/issues', [DriverController::class, 'reportRideIssue'])->middleware('throttle:customer-write');
        Route::post('/rides/{booking}/payment-status', [DriverController::class, 'updatePaymentStatus'])->middleware('throttle:payment-write');
        Route::post('/rides/{booking}/notes', [DriverController::class, 'updateRideNote'])->middleware('throttle:customer-write');

        Route::get('/funding-status', [DriverController::class, 'fundingStatus']);
        Route::post('/top-up', [DriverController::class, 'topUp'])->middleware(['throttle:payment-write', 'idempotency']);
        Route::post('/top-up/verify', [DriverController::class, 'verifyTopUp'])->middleware(['throttle:payment-write', 'idempotency']);

        // Tour Assignments
        Route::get('/tour-assignments', [DriverAppController::class, 'tourAssignments']);
        Route::get('/tour-assignments/{assignment}/attendance', [DriverAppController::class, 'assignmentAttendance']);
        Route::get('/tour-assignments/{assignment}/cash-summary', [DriverAppController::class, 'tourCashSummary']);
        Route::post('/tour-bookings/{booking}/collect-cash', [DriverAppController::class, 'collectTourCash'])->middleware(['throttle:payment-write', 'idempotency']);
        Route::post('/tour-bookings/{booking}/mark-no-show', [DriverAppController::class, 'markNoShow'])->middleware('throttle:customer-write');
        Route::post('/tour-assignments/{id}/accept', [DriverAppController::class, 'acceptTourAssignment'])->middleware('throttle:customer-write');
        Route::post('/tour-assignments/{id}/decline', [DriverAppController::class, 'declineTourAssignment'])->middleware('throttle:customer-write');
        Route::post('/tour-assignments/{id}/complete', [DriverAppController::class, 'completeTourAssignment'])->middleware('throttle:customer-write');
        Route::get('/rental-assignments', [DriverAppController::class, 'rentalAssignments']);
        Route::post('/rentals/{rental}/accept', [DriverAppController::class, 'acceptRental'])->middleware('throttle:customer-write');
        Route::post('/rentals/{rental}/decline', [DriverAppController::class, 'declineRental'])->middleware('throttle:customer-write');
        Route::post('/rentals/{rental}/complete', [DriverAppController::class, 'completeRental'])->middleware('throttle:customer-write');

        Route::get('/car-rentals/{carRental}/checklists', [DriverAppController::class, 'carRentalChecklists']);
        Route::post('/car-rentals/{carRental}/checklist', [DriverAppController::class, 'submitCarRentalChecklist'])->middleware('throttle:customer-write');

        Route::post('/tracking/location', [TrackingController::class, 'updateDriverLocation'])->middleware('throttle:120,1');
        Route::post('/tracking/ride/{booking}/location', [TrackingController::class, 'updateRideLocation'])->middleware('throttle:120,1');
        Route::post('/tracking/ride/{booking}/status', [TrackingController::class, 'updateRideStatus'])->middleware('throttle:30,1');
        Route::get('/tracking/ride/{booking}', [TrackingController::class, 'getTrackingInfo']);
        Route::post('/tracking/tour/{booking}/location', [TrackingController::class, 'updateTourLocation'])->middleware('throttle:120,1');
        Route::post('/tracking/tour/{booking}/status', [TrackingController::class, 'updateTourStatus'])->middleware('throttle:30,1');
        Route::get('/tracking/tour/{booking}', [TrackingController::class, 'getTourTrackingInfo']);
        Route::post('/tracking/rental/{rental}/location', [TrackingController::class, 'updateRentalLocation'])->middleware('throttle:120,1');
        Route::post('/tracking/rental/{rental}/status', [TrackingController::class, 'updateRentalStatus'])->middleware('throttle:30,1');
        Route::get('/tracking/rental/{rental}', [TrackingController::class, 'getRentalTrackingInfo']);
        Route::get('/wallet', [WalletController::class, 'getWallet']);
        Route::get('/wallet/transactions', [WalletController::class, 'getTransactions']);
        Route::get('/wallet/stats', [WalletController::class, 'getStats']);
        Route::post('/wallet/topup/order', [WalletController::class, 'createTopUpOrder'])->middleware(['throttle:payment-write', 'idempotency']);
        Route::post('/wallet/topup/verify', [WalletController::class, 'verifyTopUp'])->middleware(['throttle:payment-write', 'idempotency']);
        Route::get('/withdrawals', [WithdrawalController::class, 'index']);
        Route::post('/withdrawals', [WithdrawalController::class, 'store'])->middleware(['throttle:payment-write', 'idempotency']);
    });
});

/*
|--------------------------------------------------------------------------
| Guide App Routes
|--------------------------------------------------------------------------
*/
Route::prefix('guide-app')->group(function () {
    Route::any('/{any?}', function () {
        return response()->json([
            'success' => false,
            'message' => 'Guide app APIs are deprecated. Tour guide capabilities now live in the driver app.',
        ], 410);
    })->where('any', '.*');
});

/*
|--------------------------------------------------------------------------
| Admin API Routes (State-modifying actions)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin/api')->group(function () {
    Route::post('/customers/{customer}/toggle-status', [AdminCustomerController::class, 'toggleStatus']);
    Route::post('/drivers/{driver}/approve', [AdminDriverController::class, 'approve']);
    Route::post('/drivers/{driver}/suspend', [AdminDriverController::class, 'suspend']);
    Route::post('/drivers/{driver}/activate', [AdminDriverController::class, 'activate']);
    Route::get('/tour-inquiries', [\App\Http\Controllers\AdminController::class, 'tourInquiries']);
    Route::patch('/tour-inquiries/{inquiry}', [\App\Http\Controllers\AdminController::class, 'updateTourInquiry']);
    Route::post('/tour-inquiries/{inquiry}/notify', [\App\Http\Controllers\AdminController::class, 'notifyTourInquiry']);
    Route::post('/tour-bookings/{booking}/review-no-show', [\App\Http\Controllers\AdminController::class, 'reviewNoShow']);
});

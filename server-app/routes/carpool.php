<?php

use App\Http\Controllers\Api\CarpoolController;
use Illuminate\Support\Facades\Route;

Route::prefix('carpool')->middleware('throttle:60,1')->group(function () {
    Route::get('/rides', [CarpoolController::class, 'search']);
    Route::get('/rides/{ride}', [CarpoolController::class, 'show']);
    Route::post('/webhook', [CarpoolController::class, 'webhook']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/options', [CarpoolController::class, 'configuration']);
        Route::get('/mine', [CarpoolController::class, 'mine']);
        Route::post('/rides', [CarpoolController::class, 'save']);
        Route::put('/rides/{ride}', [CarpoolController::class, 'save']);
        Route::post('/rides/{ride}/book', [CarpoolController::class, 'book']);
        Route::post('/rides/{ride}/{action}', [CarpoolController::class, 'rideAction'])->where('action', 'cancel|start|complete');
        Route::post('/bookings/{booking}/review', [CarpoolController::class, 'review']);
        Route::post('/bookings/{booking}/complaint', [CarpoolController::class, 'complaint']);
        Route::post('/bookings/{booking}/checkout', [CarpoolController::class, 'checkout']);
        Route::post('/bookings/{booking}/test-payment', [CarpoolController::class, 'testPayment']);
        Route::post('/bookings/{booking}/{action}', [CarpoolController::class, 'bookingAction'])->where('action', 'approve|reject|cancel|check-in|no-show|cash-collected')->middleware('throttle:10,1');
    });
});

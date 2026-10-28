<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\ReceiptResource;
use App\Models\RideBooking;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Authenticated v1 receipt endpoint. Reference implementation proving the whole
 * v1 contract end to end: Sanctum auth + ownership check, the success envelope,
 * a versioned Resource, and the {amount_minor, currency} money shape with
 * ISO-8601 dates (SKY-MRD-001 §9).
 */
class BookingReceiptController extends Controller
{
    public function show(Request $request, RideBooking $booking): JsonResponse
    {
        // Same ownership rule as the legacy ride endpoints (owner/driver/admin).
        Gate::authorize('view', $booking);

        $booking->loadMissing('payments');

        return ApiResponse::success(
            (new ReceiptResource($booking))->resolve($request)
        );
    }
}

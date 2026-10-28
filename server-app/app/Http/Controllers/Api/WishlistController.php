<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarCategory;
use App\Models\Place;
use App\Models\Tour;
use App\Models\Vehicle;
use App\Models\Wishlist;
use App\Support\MediaUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    /**
     * Get the authenticated customer's wishlist.
     */
    public function index(Request $request): JsonResponse
    {
        $customer = $request->user();
        if (! $customer) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthenticated',
            ], 401);
        }

        $items = Wishlist::where('customer_id', $customer->id)
            ->orderBy('created_at', 'desc')
            ->get();

        $tours = [];
        $rentals = [];
        $places = [];

        foreach ($items as $item) {
            if ($item->service_type === 'tour') {
                $tour = Tour::where('id', $item->service_id)
                    ->orWhere('slug', $item->service_id)
                    ->first();

                if ($tour) {
                    $tours[] = [
                        'id' => (string) $tour->id,
                        'wishlist_id' => $item->id,
                        'service_type' => 'tour',
                        'title' => $tour->title,
                        'image' => MediaUrl::resolve($tour->cover_image),
                        'duration' => $tour->duration_days ? "{$tour->duration_days} days" : null,
                        'price' => (float) ($tour->price_per_person ?? 0),
                    ];
                }
            } elseif ($item->service_type === 'rental') {
                $category = CarCategory::where('id', $item->service_id)
                    ->orWhere('slug', $item->service_id)
                    ->first();

                if ($category) {
                    $firstImg = ! empty($category->images) ? MediaUrl::resolve($category->images[0]) : null;
                    $rentals[] = [
                        'id' => (string) $category->id,
                        'wishlist_id' => $item->id,
                        'service_type' => 'rental',
                        'title' => $category->name,
                        'image' => $firstImg,
                        'price' => (float) ($category->base_price_per_day ?? 0),
                    ];
                } else {
                    $vehicle = Vehicle::find($item->service_id);
                    if ($vehicle) {
                        $vehicleCategory = $vehicle->category;
                        $firstImg = ! empty($vehicleCategory?->images) ? MediaUrl::resolve($vehicleCategory->images[0]) : null;
                        $rentals[] = [
                            'id' => (string) $vehicle->id,
                            'wishlist_id' => $item->id,
                            'service_type' => 'rental',
                            'title' => "{$vehicle->make} {$vehicle->model}",
                            'image' => $firstImg,
                            'price' => (float) ($vehicleCategory?->base_price_per_day ?? 0),
                        ];
                    }
                }
            } elseif ($item->service_type === 'destination') {
                $place = Place::where('id', $item->service_id)
                    ->orWhere('slug', $item->service_id)
                    ->first();

                if ($place) {
                    $places[] = [
                        'id' => (string) $place->id,
                        'wishlist_id' => $item->id,
                        'service_type' => 'destination',
                        'title' => $place->name,
                        'image' => MediaUrl::resolve($place->cover_image),
                    ];
                }
            }
        }

        $total = count($tours) + count($rentals) + count($places);

        return response()->json([
            'success' => true,
            'data' => [
                'tours' => $tours,
                'rentals' => $rentals,
                'places' => $places,
                'total' => $total,
            ],
            'meta' => [
                'count' => $total,
            ],
        ]);
    }

    /**
     * Handle tour wishlist toggle or check.
     */
    public function toggleTour(Request $request, string $tourId, string $action): JsonResponse
    {
        $customer = $request->user();
        if (! $customer) {
            return response()->json([
                'success' => true,
                'data' => [
                    'inWishlist' => false,
                    'tour_id' => $tourId,
                    'authenticated' => false,
                ],
            ]);
        }

        $serviceId = trim($tourId);

        if ($action === 'check') {
            $exists = Wishlist::isTourInWishlist($customer->id, $serviceId);

            return response()->json([
                'success' => true,
                'data' => [
                    'inWishlist' => $exists,
                    'tour_id' => $serviceId,
                ],
            ]);
        }

        if ($action === 'add') {
            Wishlist::firstOrCreate([
                'customer_id' => $customer->id,
                'service_type' => 'tour',
                'service_id' => $serviceId,
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'inWishlist' => true,
                    'tour_id' => $serviceId,
                ],
            ]);
        }

        if ($action === 'remove') {
            Wishlist::where('customer_id', $customer->id)
                ->where('service_type', 'tour')
                ->where('service_id', $serviceId)
                ->delete();

            return response()->json([
                'success' => true,
                'data' => [
                    'inWishlist' => false,
                    'tour_id' => $serviceId,
                ],
            ]);
        }

        return response()->json([
            'success' => false,
            'error' => 'Invalid action',
        ], 400);
    }

    /**
     * Generic toggle for any service type.
     */
    public function toggle(Request $request): JsonResponse
    {
        $customer = $request->user();
        if (! $customer) {
            return response()->json(['success' => false, 'error' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate([
            'service_type' => 'required|in:tour,rental,destination',
            'service_id' => 'required|string',
            'action' => 'required|in:add,remove,check',
        ]);

        $serviceId = (string) $validated['service_id'];

        $exists = Wishlist::where('customer_id', $customer->id)
            ->where('service_type', $validated['service_type'])
            ->where('service_id', $serviceId)
            ->exists();

        if ($validated['action'] === 'check') {
            return response()->json([
                'success' => true,
                'data' => ['inWishlist' => $exists],
            ]);
        }

        if ($validated['action'] === 'add') {
            if (! $exists) {
                Wishlist::create([
                    'customer_id' => $customer->id,
                    'service_type' => $validated['service_type'],
                    'service_id' => $serviceId,
                ]);
            }

            return response()->json([
                'success' => true,
                'data' => ['inWishlist' => true],
            ]);
        }

        if ($validated['action'] === 'remove') {
            Wishlist::where('customer_id', $customer->id)
                ->where('service_type', $validated['service_type'])
                ->where('service_id', $serviceId)
                ->delete();

            return response()->json([
                'success' => true,
                'data' => ['inWishlist' => false],
            ]);
        }

        return response()->json(['success' => false, 'error' => 'Invalid action'], 400);
    }

    /**
     * Batch sync guest items from local storage to the authenticated user's wishlist.
     */
    public function sync(Request $request): JsonResponse
    {
        $customer = $request->user();
        if (! $customer) {
            return response()->json(['success' => false, 'error' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.service_type' => 'required|in:tour,rental,destination',
            'items.*.service_id' => 'required|string',
        ]);

        foreach ($validated['items'] as $item) {
            Wishlist::firstOrCreate([
                'customer_id' => $customer->id,
                'service_type' => $item['service_type'],
                'service_id' => (string) $item['service_id'],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Wishlist items synchronized successfully.',
        ]);
    }
}

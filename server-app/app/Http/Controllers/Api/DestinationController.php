<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Destination;
use Illuminate\Http\Request;

class DestinationController extends Controller
{
    /**
     * Display a listing of destinations.
     */
    public function index(Request $request)
    {
        $query = Destination::query();

        // Filter by state if provided
        if ($request->has('state') && ! empty($request->state)) {
            $query->where('state', $request->state);
        }

        // Filter by type if provided
        if ($request->has('type') && ! empty($request->type)) {
            $query->where('type', $request->type);
        }

        // Filter by region if provided
        if ($request->has('region') && ! empty($request->region)) {
            $query->where('region', $request->region);
        }

        // Filter by active status
        if ($request->has('active') && $request->boolean('active')) {
            $query->where('is_active', true);
        } elseif ($request->has('active') && ! $request->boolean('active')) {
            $query->where('is_active', false);
        }

        $destinations = $query->orderBy('sort_order')->orderBy('name')->paginate(15);

        return response()->json($destinations);
    }

    /**
     * Store a newly created destination.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:destinations,name',
            'description' => 'nullable|string',
            'state' => 'required|string|max:100',
            'region' => 'nullable|string|max:100',
            'type' => 'required|string|in:city,hill_station,beach,historical,cultural,nature,adventure,religious',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'popular_routes' => 'nullable|array',
            'popular_routes.*' => 'string',
            'distance_from_guwahati' => 'nullable|numeric|min:0',
            'estimated_travel_time' => 'nullable|integer|min:0',
            'best_time_to_visit' => 'nullable|array',
            'best_time_to_visit.*' => 'string',
            'attractions' => 'nullable|array',
            'attractions.*' => 'string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'is_active' => 'boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $destination = Destination::create($validated);

        return response()->json([
            'message' => 'Destination created successfully',
            'destination' => $destination,
        ], 201);
    }

    /**
     * Display the specified destination.
     */
    public function show(Destination $destination)
    {
        return response()->json($destination);
    }

    /**
     * Update the specified destination.
     */
    public function update(Request $request, Destination $destination)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:destinations,name,'.$destination->id,
            'description' => 'nullable|string',
            'state' => 'required|string|max:100',
            'region' => 'nullable|string|max:100',
            'type' => 'required|string|in:city,hill_station,beach,historical,cultural,nature,adventure,religious',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'popular_routes' => 'nullable|array',
            'popular_routes.*' => 'string',
            'distance_from_guwahati' => 'nullable|numeric|min:0',
            'estimated_travel_time' => 'nullable|integer|min:0',
            'best_time_to_visit' => 'nullable|array',
            'best_time_to_visit.*' => 'string',
            'attractions' => 'nullable|array',
            'attractions.*' => 'string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'is_active' => 'boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $destination->update($validated);

        return response()->json([
            'message' => 'Destination updated successfully',
            'destination' => $destination,
        ]);
    }

    /**
     * Remove the specified destination.
     */
    public function destroy(Destination $destination)
    {
        // Check if there are any tours using this destination
        if ($destination->tours()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete destination as it has associated tours',
            ], 422);
        }

        $destination->delete();

        return response()->json([
            'message' => 'Destination deleted successfully',
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarCategory;
use Illuminate\Http\Request;

class CarCategoryController extends Controller
{
    /**
     * Display a listing of car categories.
     */
    public function index(Request $request)
    {
        $query = CarCategory::query();

        // Filter by vehicle type if provided
        if ($request->has('type') && ! empty($request->type)) {
            $query->where('vehicle_type', $request->type);
        }

        // Filter by active status
        if ($request->has('active') && $request->boolean('active')) {
            $query->where('is_active', true);
        } elseif ($request->has('active') && ! $request->boolean('active')) {
            $query->where('is_active', false);
        }

        $carCategories = $query->orderBy('sort_order')->orderBy('name')->paginate(15);

        return response()->json($carCategories);
    }

    /**
     * Get all active car categories for frontend display.
     */
    public function getActiveCategories()
    {
        $carCategories = CarCategory::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json($carCategories);
    }

    /**
     * Store a newly created car category.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:car_categories,name',
            'description' => 'nullable|string',
            'vehicle_type' => 'required|string|in:sedan,suv,hatchback,convertible,van,truck',
            'seats' => 'required|integer|min:1|max:20',
            'has_ac' => 'boolean',
            'has_driver' => 'boolean',
            'base_price_per_day' => 'required|numeric|min:0',
            'price_per_km' => 'required|numeric|min:0',
            'features' => 'nullable|array',
            'features.*' => 'string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'fuel_type' => 'nullable|string|in:petrol,diesel,electric,hybrid',
            'year' => 'nullable|integer|min:1900|max:'.(date('Y') + 1),
            'is_active' => 'boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $carCategory = CarCategory::create($validated);

        return response()->json([
            'message' => 'Car category created successfully',
            'car_category' => $carCategory,
        ], 201);
    }

    /**
     * Display the specified car category.
     */
    public function show(CarCategory $carCategory)
    {
        return response()->json($carCategory);
    }

    /**
     * Update the specified car category.
     */
    public function update(Request $request, CarCategory $carCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:car_categories,name,'.$carCategory->id,
            'description' => 'nullable|string',
            'vehicle_type' => 'required|string|in:sedan,suv,hatchback,convertible,van,truck',
            'seats' => 'required|integer|min:1|max:20',
            'has_ac' => 'boolean',
            'has_driver' => 'boolean',
            'base_price_per_day' => 'required|numeric|min:0',
            'price_per_km' => 'required|numeric|min:0',
            'features' => 'nullable|array',
            'features.*' => 'string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'fuel_type' => 'nullable|string|in:petrol,diesel,electric,hybrid',
            'year' => 'nullable|integer|min:1900|max:'.(date('Y') + 1),
            'is_active' => 'boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $carCategory->update($validated);

        return response()->json([
            'message' => 'Car category updated successfully',
            'car_category' => $carCategory,
        ]);
    }

    /**
     * Remove the specified car category.
     */
    public function destroy(CarCategory $carCategory)
    {
        // Check if there are any car rentals using this category
        if ($carCategory->carRentals()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete car category as it has associated car rentals',
            ], 422);
        }

        $carCategory->delete();

        return response()->json([
            'message' => 'Car category deleted successfully',
        ]);
    }
}

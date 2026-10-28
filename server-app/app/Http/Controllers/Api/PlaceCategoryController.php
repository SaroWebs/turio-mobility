<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlaceCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PlaceCategoryController extends Controller
{
    /**
     * Get all place categories
     */
    public function index(Request $request)
    {
        $categories = PlaceCategory::getActiveCategories();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Get featured place categories
     */
    public function getFeatured(Request $request)
    {
        $categories = PlaceCategory::getFeaturedCategories();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Get place category by ID
     */
    public function show(Request $request, $id)
    {
        $category = PlaceCategory::find($id);

        if (! $category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $category,
        ]);
    }

    /**
     * Create new place category (Admin only)
     */
    public function store(Request $request)
    {
        // Check if user has admin role
        if (! $request->user()->hasRole('admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:place_categories,name',
            'description' => 'nullable|string|max:500',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|regex:/^#[0-9A-F]{6}$/i',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $category = PlaceCategory::create($request->all());

        return response()->json([
            'success' => true,
            'data' => $category,
            'message' => 'Category created successfully',
        ], 201);
    }

    /**
     * Update place category (Admin only)
     */
    public function update(Request $request, $id)
    {
        // Check if user has admin role
        if (! $request->user()->hasRole('admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $category = PlaceCategory::find($id);

        if (! $category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'string|max:100|unique:place_categories,name,'.$id,
            'description' => 'nullable|string|max:500',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|regex:/^#[0-9A-F]{6}$/i',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $category->update($request->all());

        return response()->json([
            'success' => true,
            'data' => $category,
            'message' => 'Category updated successfully',
        ]);
    }

    /**
     * Delete place category (Admin only)
     */
    public function destroy(Request $request, $id)
    {
        // Check if user has admin role
        if (! $request->user()->hasRole('admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $category = PlaceCategory::find($id);

        if (! $category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found',
            ], 404);
        }

        // Check if category has places
        if ($category->places()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete category with associated places',
            ], 400);
        }

        $category->delete();

        return response()->json([
            'success' => true,
            'message' => 'Category deleted successfully',
        ]);
    }
}

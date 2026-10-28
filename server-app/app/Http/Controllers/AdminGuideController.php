<?php

namespace App\Http\Controllers;

use App\Models\Guide;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AdminGuideController extends Controller
{
    /**
     * List all guides with pagination and search.
     */
    public function index(Request $request)
    {
        $query = Guide::query();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $guides = $query->latest()->paginate(15);

        return inertia('admin/Guides/Index', [
            'title' => 'Guide Management',
            'user' => Auth::user(),
            'guides' => $guides,
            'filters' => $request->only(['search', 'status']),
        ]);
    }

    /**
     * Show guide details.
     */
    public function show(Guide $guide)
    {
        $guide->load([
            'tourGuideAssignments.schedule.tour' => fn ($q) => $q->select('id', 'title'),
            'tourBookingAssignments' => fn ($q) => $q->latest()->take(15),
        ]);

        $stats = [
            'total_tours' => $guide->total_tours,
            'rating' => $guide->rating,
        ];

        return inertia('admin/Guides/Show', [
            'title' => 'Guide Details',
            'user' => Auth::user(),
            'guide' => $guide,
            'stats' => $stats,
        ]);
    }

    /**
     * Approve a pending guide.
     */
    public function approve(Guide $guide)
    {
        $guide->update([
            'is_approved' => true,
            'status' => 'active',
            'approved_at' => now(),
            'approved_by' => Auth::id(),
        ]);

        return redirect()->back()->with('success', "Guide {$guide->name} has been approved.");
    }

    /**
     * Suspend a guide.
     */
    public function suspend(Guide $guide)
    {
        $guide->update(['status' => 'suspended', 'is_active' => false]);

        // Revoke all tokens
        $guide->tokens()->delete();

        return redirect()->back()->with('success', "Guide {$guide->name} has been suspended.");
    }

    /**
     * Reactivate a suspended guide.
     */
    public function activate(Guide $guide)
    {
        $guide->update(['status' => 'active', 'is_active' => true]);

        return redirect()->back()->with('success', "Guide {$guide->name} has been reactivated.");
    }
}

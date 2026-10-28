<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TourGuideAssignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GuideAppController extends Controller
{
    /**
     * Dashboard statistics for the authenticated guide.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $guide = $request->user();

        $upcomingToursCount = TourGuideAssignment::where('guide_id', $guide->id)
            ->whereIn('status', ['accepted', 'assigned'])
            ->whereHas('schedule', function ($q) {
                $q->where(fn ($sub) => $sub->where('departure_at', '>=', now()->utc())->orWhere(fn ($s) => $s->whereNull('departure_at')->where('departure_date', '>=', now()->toDateString())));
            })
            ->count();

        $completedToursCount = TourGuideAssignment::where('guide_id', $guide->id)
            ->where('status', 'completed')
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'upcoming_tours_count' => $upcomingToursCount,
                'completed_tours_count' => $completedToursCount,
                'rating' => $guide->rating,
                'total_tours' => $guide->total_tours,
            ],
        ]);
    }

    /**
     * List all assignments for the authenticated guide, grouped by upcoming/past.
     */
    public function assignments(Request $request): JsonResponse
    {
        $guide = $request->user();

        $assignments = TourGuideAssignment::with(['schedule.tour'])
            ->where('guide_id', $guide->id)
            ->orderByDesc('id')
            ->get();

        $upcoming = $assignments->filter(function ($assignment) {
            if (! $assignment->schedule || in_array($assignment->status, ['declined', 'completed'])) {
                return false;
            }
            $departureInstant = $assignment->schedule->departure_at ?? \Carbon\Carbon::parse($assignment->schedule->departure_date->toDateString().' '.($assignment->schedule->departure_time ?: '00:00:00'), config('app.business_timezone', 'Asia/Kolkata'))->utc();

            return $departureInstant->gte(now()->utc());
        })->values();

        $past = $assignments->filter(function ($assignment) {
            if (! $assignment->schedule) {
                return false;
            }
            if (in_array($assignment->status, ['declined', 'completed'])) {
                return true;
            }
            $departureInstant = $assignment->schedule->departure_at ?? \Carbon\Carbon::parse($assignment->schedule->departure_date->toDateString().' '.($assignment->schedule->departure_time ?: '00:00:00'), config('app.business_timezone', 'Asia/Kolkata'))->utc();

            return $departureInstant->lt(now()->utc());
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'upcoming' => $upcoming,
                'past' => $past,
            ],
        ]);
    }

    /**
     * Accept a pending assignment.
     */
    public function acceptAssignment(Request $request, $id): JsonResponse
    {
        $assignment = TourGuideAssignment::where('guide_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        if ($assignment->status !== 'assigned') {
            return response()->json([
                'success' => false,
                'message' => 'Assignment cannot be accepted (current status: '.$assignment->status.').',
            ], 400);
        }

        $assignment->update(['status' => 'accepted']);

        return response()->json([
            'success' => true,
            'message' => 'Assignment accepted successfully.',
            'data' => $assignment,
        ]);
    }

    /**
     * Decline a pending assignment.
     */
    public function declineAssignment(Request $request, $id): JsonResponse
    {
        $assignment = TourGuideAssignment::where('guide_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        if ($assignment->status !== 'assigned') {
            return response()->json([
                'success' => false,
                'message' => 'Assignment cannot be declined (current status: '.$assignment->status.').',
            ], 400);
        }

        $assignment->update(['status' => 'declined']);

        return response()->json([
            'success' => true,
            'message' => 'Assignment declined.',
            'data' => $assignment,
        ]);
    }

    /**
     * Mark an assignment as completed.
     */
    public function completeAssignment(Request $request, $id): JsonResponse
    {
        $assignment = TourGuideAssignment::where('guide_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        if ($assignment->status !== 'accepted') {
            return response()->json([
                'success' => false,
                'message' => 'Assignment cannot be completed unless it is in "accepted" status.',
            ], 400);
        }

        $assignment->update(['status' => 'completed']);

        return response()->json([
            'success' => true,
            'message' => 'Assignment marked as completed.',
            'data' => $assignment,
        ]);
    }
}

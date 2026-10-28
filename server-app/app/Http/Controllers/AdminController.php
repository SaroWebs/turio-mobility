<?php

namespace App\Http\Controllers;

use App\Models\BookingAuditLog;
use App\Models\BookingIncident;
use App\Models\BookingRefund;
use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Destination;
use App\Models\Driver;
use App\Models\DriverAvailability;
use App\Models\Place;
use App\Models\PlaceMedia;
use App\Models\ReconciliationMismatch;
use App\Models\RideBooking;
use App\Models\Role;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourCategory;
use App\Models\TourItinerary;
use App\Models\TourSchedule;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Rules\FileIsClean;
use App\Services\BookingCancellationService;
use App\Services\BookingLifecycleNotifier;
use App\Services\BookingStatusService;
use App\Services\CommissionService;
use App\Services\DriverDispatchService;
use App\Services\GooglePlaceDetailsService;
use App\Services\RentalDriverService;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class AdminController extends Controller
{
    /**
     * Admin dashboard
     */
    public function dashboard()
    {
        return inertia('admin/Dashboard', [
            'title' => 'Admin Dashboard',
            'user' => Auth::user(),
            'stats' => [
                'total_users' => User::count(),
                'total_customers' => Customer::count(),
                'total_drivers' => Driver::count(),
                'total_tours' => Tour::count(),
                'total_bookings' => TourBooking::count(),
                'total_ride_bookings' => RideBooking::count(),
                'total_places' => Place::count(),
                'active_tours' => Tour::where('available_from', '>=', now())->count(),
                'recent_bookings' => TourBooking::with('customer', 'tour')->latest()->take(5)->get(),
            ],
            'recent_users' => User::with('roles')->latest()->take(5)->get(),
            'upcoming_tours' => Tour::with(['schedules.driverAssignments.driver'])->where('available_from', '>=', now())->take(5)->get(),
        ]);
    }

    public function walletReconciliation(Request $request)
    {
        $validated = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'owner_type' => 'nullable|in:customer,driver',
        ]);

        $transactions = WalletTransaction::query()
            ->when(isset($validated['from']), fn ($query) => $query->whereDate('created_at', '>=', $validated['from']))
            ->when(isset($validated['to']), fn ($query) => $query->whereDate('created_at', '<=', $validated['to']))
            ->when(isset($validated['owner_type']), function ($query) use ($validated) {
                $ownerClass = $validated['owner_type'] === 'driver' ? Driver::class : Customer::class;

                $query->whereHas('wallet', fn ($walletQuery) => $walletQuery->where('owner_type', $ownerClass));
            });

        $credits = (clone $transactions)->where('type', 'credit')->sum('amount');
        $debits = (clone $transactions)->where('type', 'debit')->sum('amount');
        $wallets = Wallet::query()
            ->when(isset($validated['owner_type']), function ($query) use ($validated) {
                $ownerClass = $validated['owner_type'] === 'driver' ? Driver::class : Customer::class;

                $query->where('owner_type', $ownerClass);
            });

        return response()->json([
            'success' => true,
            'data' => [
                'filters' => [
                    'from' => $validated['from'] ?? null,
                    'to' => $validated['to'] ?? null,
                    'owner_type' => $validated['owner_type'] ?? null,
                ],
                'wallet_count' => (clone $wallets)->count(),
                'active_wallet_count' => (clone $wallets)->where('is_active', true)->count(),
                'wallet_balance_total' => round((float) (clone $wallets)->sum('balance'), 2),
                'credit_total' => round((float) $credits, 2),
                'debit_total' => round((float) $debits, 2),
                'net_movement' => round((float) $credits - (float) $debits, 2),
                'transaction_count' => (clone $transactions)->count(),
                'recent_transactions' => (clone $transactions)
                    ->with('wallet:id,owner_type,owner_id,balance,currency,is_active')
                    ->latest()
                    ->take(20)
                    ->get(),
                'reconciliation' => $this->reconciliationSummary(),
            ],
        ]);
    }

    /**
     * Open discrepancies from the nightly reconciliation sweep (SKY-MRD-001
     * §13.3), surfaced alongside the wallet movement summary so an operator sees
     * ledger/payment/payout/provider drift in one place.
     *
     * @return array<string,mixed>
     */
    private function reconciliationSummary(): array
    {
        $open = ReconciliationMismatch::open()
            ->orderByDesc('detected_at')
            ->get();

        return [
            'open_count' => $open->count(),
            'open_by_type' => $open->groupBy('type')->map->count(),
            'last_detected_at' => optional($open->max('detected_at'))?->toIso8601String(),
            'recent_open' => $open->take(20)->map(fn (ReconciliationMismatch $m) => [
                'id' => $m->id,
                'type' => $m->type,
                'reference_type' => $m->reference_type,
                'reference_id' => $m->reference_id,
                'provider_reference' => $m->provider_reference,
                'expected_minor' => $m->expected_minor,
                'actual_minor' => $m->actual_minor,
                'delta_minor' => (int) $m->actual_minor - (int) $m->expected_minor,
                'currency' => $m->currency,
                'details' => $m->details,
                'detected_at' => optional($m->detected_at)?->toIso8601String(),
            ])->values(),
        ];
    }

    /**
     * Admin profile page
     */
    public function profile()
    {
        return Inertia::render('admin/Profile', [
            'title' => 'My Profile',
            'user' => Auth::user(),
            'target_user' => Auth::user()->load('roles'),
        ]);
    }

    /**
     * Update admin's own profile info
     */
    public function updateProfile(Request $request)
    {
        $user = Auth::user();

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,'.$user->id,
            'phone' => 'required|string|unique:users,phone,'.$user->id,
        ]);

        $user->update([
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
        ]);

        return back()->with('success', 'Profile updated successfully.');
    }

    /**
     * Change admin's own password
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string|current_password',
            'password' => 'required|string|min:8|confirmed',
            'password_confirmation' => 'required|string',
        ]);

        Auth::user()->update([
            'password' => bcrypt($request->password),
        ]);

        return back()->with('success', 'Password changed successfully.');
    }

    /**
     * User management
     */
    public function users()
    {
        return inertia('admin/Users/Index', [
            'title' => 'User Management',
            'user' => Auth::user(),
            'users' => User::with('roles')->paginate(15),
            'roles' => Role::active()->orderBy('name')->get(),
        ]);
    }

    /**
     * Show user details
     */
    public function showUser(User $user)
    {
        $data = [
            'title' => 'User Details',
            'user' => Auth::user(),
            'target_user' => $user->load(['roles']),
        ];

        return Inertia::render('admin/Users/Show', $data);
    }

    /**
     * Create user form
     */
    public function createUser()
    {
        $data = [
            'title' => 'Create User',
            'user' => Auth::user(),
            'roles' => Role::active()->orderBy('name')->get(),
        ];

        return Inertia::render('admin/Users/Create', $data);
    }

    /**
     * Store new user
     */
    public function storeUser(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'phone' => 'required|string|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role' => 'required|string|exists:roles,name',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password' => bcrypt($request->password),
        ]);

        $user->assignRole($request->role);

        return redirect()->route('admin.users')->with('success', 'User created successfully');
    }

    /**
     * Edit user form
     */
    public function editUser(User $user)
    {
        $data = [
            'title' => 'Edit User',
            'user' => Auth::user(),
            'target_user' => $user->load(['roles']),
            'roles' => Role::active()->orderBy('name')->get(),
        ];

        return Inertia::render('admin/Users/Edit', $data);
    }

    /**
     * Update user
     */
    public function updateUser(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,'.$user->id,
            'phone' => 'required|string|unique:users,phone,'.$user->id,
            'role' => 'required|string|exists:roles,name',
        ]);

        $user->update([
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
        ]);

        // Update user role
        $user->roles()->detach();
        $user->assignRole($request->role);

        return redirect()->route('admin.users')->with('success', 'User updated successfully');
    }

    /**
     * Delete user
     */
    public function deleteUser(User $user)
    {
        // Prevent admin from deleting themselves
        if ($user->id === Auth::id()) {
            return back()->with('error', 'You cannot delete your own account');
        }

        $user->delete();

        return redirect()->route('admin.users')->with('success', 'User deleted successfully');
    }

    /**
     * Tours management
     */
    public function tours()
    {
        $toursPaginator = Tour::with(['schedules.driverAssignments.driver'])
            ->withCount('itineraries')
            ->paginate(12);

        // Transform data to match frontend expectations
        $toursPaginator->getCollection()->transform(function ($tour) {
            // Keep original field names - frontend expects 'title'
            return $tour;
        });

        return inertia('admin/Tours', [
            'title' => 'Tour Management',
            'user' => Auth::user(),
            'tours' => $toursPaginator,
        ]);
    }

    /**
     * Show create tour form
     */
    public function createTour()
    {
        return inertia('admin/Tours/Create', [
            'title' => 'Create Tour',
            'user' => Auth::user(),
            'categories' => TourCategory::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * Store new tour
     */
    public function storeTour(Request $request)
    {
        $validated = $request->validate([
            'tour_category_id' => 'nullable|exists:tour_categories,id',
            'title' => 'required|string|max:255',
            'short_description' => 'required|string|max:500',
            'description' => 'required|string|max:10000',
            'highlights' => 'nullable|array|max:20',
            'highlights.*' => 'string|max:255',
            'inclusions' => 'nullable|array|max:30',
            'inclusions.*' => 'string|max:255',
            'exclusions' => 'nullable|array|max:30',
            'exclusions.*' => 'string|max:255',
            'cancellation_policy' => 'nullable|string|max:5000',
            'min_group_size' => 'required|integer|min:1',
            'max_group_size' => 'required|integer|gte:min_group_size|max:200',
            'price_per_person' => 'required|numeric|min:0',
            'child_price' => 'required|numeric|min:0',
            'discount' => 'nullable|numeric|min:0|max:100',
            'start_location' => 'required|string|max:255',
            'end_location' => 'required|string|max:255',
            'region' => 'required|string|max:120',
            'difficulty' => 'required|in:easy,moderate,challenging,extreme',
            'cover_image' => 'nullable|url|max:2048',
            'available_from' => 'required|date',
            'available_to' => 'required|date|after:available_from',
            'is_active' => 'required|boolean',
            'is_featured' => 'required|boolean',
        ]);

        $tour = DB::transaction(function () use ($validated) {
            $slugBase = Str::slug($validated['title']) ?: 'tour';
            $slug = $slugBase;
            $suffix = 2;
            while (Tour::where('slug', $slug)->exists()) {
                $slug = $slugBase.'-'.$suffix++;
            }

            $tour = Tour::create(array_merge($validated, [
                'slug' => $slug,
                'discount' => $validated['discount'] ?? 0,
                'highlights' => $validated['highlights'] ?? [],
                'inclusions' => $validated['inclusions'] ?? [],
                'exclusions' => $validated['exclusions'] ?? [],
                'duration_days' => 0,
                'duration_nights' => 0,
            ]));

            return $tour;
        });

        return redirect()->route('admin.tours.itineraries.create', $tour)
            ->with('success', 'Tour package created. Add Day 1 to build its itinerary and duration.');
    }

    /**
     * Show tour details
     */
    public function showTour(Tour $tour)
    {
        $tour->load(['category', 'schedules.driverAssignments.driver', 'schedules.driverAssignments.vehicle', 'itineraries.place', 'bookings.customer']);

        return inertia('admin/Tours/Show', [
            'title' => 'Tour Details',
            'user' => Auth::user(),
            'tour' => $tour,
        ]);
    }

    /**
     * Show edit tour form
     */
    public function editTour(Tour $tour)
    {
        $tour->load(['schedules.driverAssignments.driver']);

        return inertia('admin/Tours/Edit', [
            'title' => 'Edit Tour',
            'user' => Auth::user(),
            'tour' => $tour,
            'categories' => TourCategory::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * Update tour
     */
    public function updateTour(Request $request, Tour $tour)
    {
        $validated = $request->validate([
            'tour_category_id' => 'nullable|exists:tour_categories,id',
            'title' => 'required|string|max:255',
            'short_description' => 'nullable|string|max:500',
            'description' => 'required|string|max:10000',
            'highlights' => 'nullable|array|max:20',
            'highlights.*' => 'string|max:255',
            'inclusions' => 'nullable|array|max:30',
            'inclusions.*' => 'string|max:255',
            'exclusions' => 'nullable|array|max:30',
            'exclusions.*' => 'string|max:255',
            'cancellation_policy' => 'nullable|string|max:5000',
            'min_group_size' => 'required|integer|min:1',
            'max_group_size' => 'required|integer|gte:min_group_size|max:200',
            'price_per_person' => 'required|numeric|min:0',
            'child_price' => 'required|numeric|min:0',
            'discount' => 'nullable|numeric|min:0|max:100',
            'start_location' => 'required|string|max:255',
            'end_location' => 'required|string|max:255',
            'region' => 'required|string|max:120',
            'difficulty' => 'required|in:easy,moderate,challenging,extreme',
            'cover_image' => 'nullable|url|max:2048',
            'available_from' => 'required|date',
            'available_to' => 'required|date|after:available_from',
            'is_active' => 'required|boolean',
            'is_featured' => 'required|boolean',
        ]);

        $tour->update(array_merge($validated, ['discount' => $validated['discount'] ?? 0]));

        return redirect()->route('admin.tours')->with('success', 'Tour updated successfully');
    }

    /**
     * Delete tour
     */
    public function deleteTour(Tour $tour)
    {
        \Illuminate\Support\Facades\DB::transaction(function () use ($tour) {
            $tour = Tour::lockForUpdate()->findOrFail($tour->id);
            $schedules = $tour->schedules()->orderBy('id')->lockForUpdate()->get();
            abort_if($tour->bookings()->exists() || $schedules->contains(fn ($schedule) => $schedule->hasBookingHistory()),
                422, 'Tours with booking history cannot be deleted. Deactivate the tour instead.');
            $tour->delete();
        });

        return redirect()->route('admin.tours')->with('success', 'Tour deleted successfully');
    }

    /**
     * Tour Itineraries management
     */
    public function tourItineraries(Tour $tour)
    {
        $itineraries = $tour->itineraries()
            ->with('place.media')
            ->orderBy('day_index')
            ->orderBy('stop_order')
            ->orderBy('time')
            ->get();

        return inertia('admin/Tours/Itineraries', [
            'title' => 'Tour Itineraries Management',
            'user' => Auth::user(),
            'tour' => $tour,
            'itineraries' => $itineraries,
        ]);
    }

    /**
     * Show create tour itinerary form
     */
    public function createTourItinerary(Request $request, Tour $tour)
    {
        $places = Place::where('is_active', true)->orderBy('name')->get();
        $maxDay = (int) $tour->itineraries()->max('day_number');
        $requestedDay = (int) $request->integer('day', $maxDay + 1);
        $suggestedDay = min(max(1, $requestedDay), $maxDay + 1);

        return inertia('admin/Tours/Itineraries/Create', [
            'title' => 'Create Tour Itinerary',
            'user' => Auth::user(),
            'tour' => $tour,
            'places' => $places,
            'nextDay' => $suggestedDay,
            'maxDay' => $maxDay,
            'dayOptions' => $tour->itineraries()
                ->selectRaw('day_number, COUNT(*) as stops_count')
                ->groupBy('day_number')
                ->orderBy('day_number')
                ->get(),
        ]);
    }

    /**
     * Store new tour itinerary
     */
    public function storeTourItinerary(Request $request, Tour $tour)
    {
        $validated = $request->validate([
            'day_number' => 'required|integer|min:1',
            'time' => 'nullable|date_format:H:i',
            'place_id' => 'required|exists:places,id',
            'title' => 'nullable|string|max:255',
            'start_location' => 'nullable|string|max:255',
            'end_location' => 'nullable|string|max:255',
            'details' => 'required|string|max:5000',
            'activities' => 'nullable|array|max:20',
            'activities.*' => 'string|max:255',
            'accommodation' => 'nullable|string|max:255',
            'meals_included' => 'nullable|array',
            'meals_included.*' => 'in:breakfast,lunch,dinner',
            'distance_km' => 'nullable|string|max:50',
            'travel_time' => 'nullable|string|max:100',
            'key_stops' => 'nullable|array|max:30',
            'key_stops.*.name' => 'required|string|max:255',
            'key_stops.*.description' => 'nullable|string|max:1000',
            'inclusions' => 'nullable|array|max:30',
            'inclusions.*' => 'string|max:255',
            'exclusions' => 'nullable|array|max:30',
            'exclusions.*' => 'string|max:255',
        ]);
        $place = Place::findOrFail($validated['place_id']);
        $maxDay = (int) $tour->itineraries()->max('day_number');
        $dayNumber = (int) $validated['day_number'];
        if ($dayNumber > $maxDay + 1) {
            return back()->withErrors(['day_number' => 'Add the next sequential day or choose an existing day.'])->withInput();
        }
        $stopOrder = ((int) $tour->itineraries()->where('day_number', $dayNumber)->max('stop_order')) + 1;

        $tour->itineraries()->create([
            'place_id' => $place->id,
            'day_index' => $dayNumber,
            'day_number' => $dayNumber,
            'stop_order' => $stopOrder,
            'time' => $validated['time'] ?? null,
            'title' => $validated['title'] ?? $place->name,
            'start_location' => $validated['start_location'] ?? null,
            'end_location' => $validated['end_location'] ?? null,
            'description' => $validated['details'],
            'details' => $validated['details'],
            'activities' => $validated['activities'] ?? [],
            'accommodation' => $validated['accommodation'] ?? null,
            'meals_included' => $validated['meals_included'] ?? [],
            'distance_km' => $validated['distance_km'] ?? null,
            'travel_time' => $validated['travel_time'] ?? null,
            'key_stops' => $validated['key_stops'] ?? [],
            'inclusions' => $validated['inclusions'] ?? [],
            'exclusions' => $validated['exclusions'] ?? [],
        ]);
        $this->syncTourDurationFromItineraries($tour);

        return redirect()->route('admin.tours.itineraries', $tour->id)
            ->with('success', "Visit {$stopOrder} added to Day {$dayNumber}. Tour duration updated automatically.");
    }

    /**
     * Show tour itinerary details
     */
    public function showTourItinerary(Tour $tour, TourItinerary $itinerary)
    {
        if ($itinerary->tour_id !== $tour->id) {
            return back()->with('error', 'Itinerary not found for this tour');
        }

        return inertia('admin/Tours/Itineraries/Show', [
            'title' => 'Tour Itinerary Details',
            'user' => Auth::user(),
            'tour' => $tour,
            'itinerary' => $itinerary->load('place.media'),
        ]);
    }

    /**
     * Show edit tour itinerary form
     */
    public function editTourItinerary(Tour $tour, TourItinerary $itinerary)
    {
        if ($itinerary->tour_id !== $tour->id) {
            return back()->with('error', 'Itinerary not found for this tour');
        }

        $places = Place::where('is_active', true)->orderBy('name')->get();

        return inertia('admin/Tours/Itineraries/Edit', [
            'title' => 'Edit Tour Itinerary',
            'user' => Auth::user(),
            'tour' => $tour,
            'itinerary' => $itinerary->load('place.media'),
            'places' => $places,
            'maxDay' => (int) $tour->itineraries()->max('day_number'),
        ]);
    }

    /**
     * Update tour itinerary
     */
    public function updateTourItinerary(Request $request, Tour $tour, TourItinerary $itinerary)
    {
        if ($itinerary->tour_id !== $tour->id) {
            return back()->with('error', 'Itinerary not found for this tour');
        }

        $validated = $request->validate([
            'day_number' => 'required|integer|min:1',
            'time' => 'nullable|date_format:H:i',
            'place_id' => 'sometimes|required|exists:places,id',
            'title' => 'nullable|string|max:255',
            'start_location' => 'nullable|string|max:255',
            'end_location' => 'nullable|string|max:255',
            'details' => 'required|string|max:5000',
            'activities' => 'nullable|array|max:20',
            'activities.*' => 'string|max:255',
            'accommodation' => 'nullable|string|max:255',
            'meals_included' => 'nullable|array',
            'meals_included.*' => 'in:breakfast,lunch,dinner',
            'distance_km' => 'nullable|string|max:50',
            'travel_time' => 'nullable|string|max:100',
            'key_stops' => 'nullable|array|max:30',
            'key_stops.*.name' => 'required|string|max:255',
            'key_stops.*.description' => 'nullable|string|max:1000',
            'inclusions' => 'nullable|array|max:30',
            'inclusions.*' => 'string|max:255',
            'exclusions' => 'nullable|array|max:30',
            'exclusions.*' => 'string|max:255',
        ]);

        $place = isset($validated['place_id']) ? Place::findOrFail($validated['place_id']) : $itinerary->place;
        $maxDay = (int) $tour->itineraries()->max('day_number');
        $dayNumber = (int) $validated['day_number'];
        if ($dayNumber > $maxDay + 1) {
            return back()->withErrors(['day_number' => 'Move the visit to an existing day or the next sequential day.'])->withInput();
        }
        $dayChanged = $dayNumber !== $itinerary->day_number;
        $stopOrder = $dayChanged
            ? ((int) $tour->itineraries()->where('day_number', $dayNumber)->max('stop_order')) + 1
            : $itinerary->stop_order;

        $itinerary->update([
            'place_id' => $place?->id,
            'day_index' => $dayNumber,
            'day_number' => $dayNumber,
            'stop_order' => $stopOrder,
            'time' => $validated['time'] ?? null,
            'title' => $validated['title'] ?? $place?->name ?? $itinerary->title,
            'start_location' => $validated['start_location'] ?? null,
            'end_location' => $validated['end_location'] ?? null,
            'description' => $validated['details'],
            'details' => $validated['details'],
            'activities' => $validated['activities'] ?? [],
            'accommodation' => $validated['accommodation'] ?? null,
            'meals_included' => $validated['meals_included'] ?? [],
            'distance_km' => $validated['distance_km'] ?? null,
            'travel_time' => $validated['travel_time'] ?? null,
            'key_stops' => $validated['key_stops'] ?? [],
            'inclusions' => $validated['inclusions'] ?? [],
            'exclusions' => $validated['exclusions'] ?? [],
        ]);
        $this->normalizeTourItineraryStops($tour);
        $this->syncTourDurationFromItineraries($tour);

        return redirect()->route('admin.tours.itineraries', $tour->id)->with('success', 'Itinerary updated successfully');
    }

    /**
     * Delete tour itinerary
     */
    public function deleteTourItinerary(Tour $tour, TourItinerary $itinerary)
    {
        if ($itinerary->tour_id !== $tour->id) {
            return back()->with('error', 'Itinerary not found for this tour');
        }

        $itinerary->delete();
        $this->normalizeTourItineraryStops($tour);
        $this->syncTourDurationFromItineraries($tour);

        return redirect()->route('admin.tours.itineraries', $tour->id)->with('success', 'Itinerary visit deleted successfully');
    }

    /**
     * Tour Bookings management
     */
    public function bookings(Request $request)
    {
        $tab = in_array($request->input('tab'), ['ride', 'tour', 'rental'], true)
            ? $request->input('tab')
            : 'ride';
        $search = trim((string) $request->input('search', ''));
        $status = trim((string) $request->input('status', ''));

        $rides = RideBooking::with(['customer:id,name,email,phone', 'driver:id,name'])
            ->when($tab === 'ride' && $search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('booking_number', 'like', "%{$search}%")
                        ->orWhere('customer_name', 'like', "%{$search}%")
                        ->orWhere('customer_phone', 'like', "%{$search}%");
                });
            })
            ->when($tab === 'ride' && $status !== '', fn ($query) => $query->where('status', $status))
            ->latest()
            ->paginate(12, ['*'], 'ride_page')
            ->withQueryString();

        $tours = TourBooking::with(['customer:id,name,email,phone', 'schedule.tour:id,title'])
            ->when($tab === 'tour' && $search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('booking_number', 'like', "%{$search}%")
                        ->orWhereHas('customer', fn ($customer) => $customer
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%"));
                });
            })
            ->when($tab === 'tour' && $status !== '', fn ($query) => $query->where('status', $status))
            ->latest()
            ->paginate(12, ['*'], 'tour_page')
            ->withQueryString();

        $rentals = CarRental::with(['customer:id,name,email,phone', 'carCategory:id,name,vehicle_type', 'driver:id,name'])
            ->when($tab === 'rental' && $search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('booking_number', 'like', "%{$search}%")
                        ->orWhere('customer_name', 'like', "%{$search}%")
                        ->orWhere('customer_phone', 'like', "%{$search}%");
                });
            })
            ->when($tab === 'rental' && $status !== '', fn ($query) => $query->where('status', $status))
            ->latest()
            ->paginate(12, ['*'], 'rental_page')
            ->withQueryString();

        return inertia('admin/Bookings', [
            'title' => 'Bookings',
            'rides' => $rides,
            'tours' => $tours,
            'rentals' => $rentals,
            'filters' => compact('tab', 'search', 'status'),
        ]);
    }

    public function tourBookings(Request $request)
    {
        return redirect()->route('admin.bookings', array_merge($request->query(), ['tab' => 'tour']));
    }

    public function showTourBooking(TourBooking $tourBooking)
    {
        $tourBooking->load([
            'customer',
            'tour',
            'schedule.tour',
            'assignedDriver:id,name,email,phone',
            'assignedVehicle',
            'driverAssignments.driver:id,name,email,phone,rating,vehicle_number',
            'driverAssignments.vehicle',
            'refunds.customer:id,name,phone',
            'refunds.walletTransaction',
            'incidents.customer:id,name,phone',
            'incidents.driver:id,name,phone',
            'auditLogs.admin:id,name,email',
            'reviews.customer:id,name',
            'reviews.driver:id,name',
        ]);

        return inertia('admin/TourBookings/Show', [
            'title' => 'Tour Booking Details',
            'user' => Auth::user(),
            'booking' => $tourBooking,
            'amendmentSchedules' => TourSchedule::where('tour_id', $tourBooking->tour_id)
                ->where('id', '!=', $tourBooking->tour_schedule_id)->bookable($tourBooking->getTotalPax())
                ->orderBy('departure_at')->get(['id', 'departure_date', 'departure_time', 'departure_point']),
        ]);
    }

    public function amendTourBooking(Request $request, TourBooking $tourBooking)
    {
        $validated = $request->validate([
            'source_schedule_id' => 'required|integer',
            'target_schedule_id' => 'required|integer|different:source_schedule_id',
            'reason' => 'required|string|max:2000',
            'customer_agreed' => 'required|accepted',
            'request_id' => 'required|uuid',
        ]);
        app(\App\Services\TourBookingAmendmentService::class)->transfer(
            $tourBooking, $validated['source_schedule_id'], $validated['target_schedule_id'],
            $validated['reason'], (int) $request->user()->id, $validated['request_id']
        );

        return response()->json(['message' => 'Departure changed. The agreed price and payment balance are preserved.']);
    }

    /**
     * Tour Schedules Management
     */
    public function tourSchedules(Tour $tour)
    {
        return inertia('admin/Tours/Schedules', [
            'title' => 'Tour Schedules',
            'user' => Auth::user(),
            'tour' => $tour,
            'schedules' => $tour->schedules()->with(['guideAssignments.guide', 'driverAssignments.driver', 'driverAssignments.vehicle'])->latest('departure_date')->paginate(15),
            'drivers' => Driver::query()
                ->where('status', 'active')
                ->where('is_active', true)
                ->where('is_approved', true)
                ->where(function ($query) {
                    $query->where('can_tour_lead', true)
                        ->orWhere('can_tour_transport', true);
                })
                ->orderBy('name')
                ->get(['id', 'name', 'phone', 'rating', 'vehicle_number', 'can_tour_lead', 'can_tour_transport']),
            'vehicles' => Vehicle::query()
                ->where('is_active', true)
                ->orderBy('registration_number')
                ->get(['id', 'driver_id', 'car_category_id', 'registration_number', 'make', 'model']),
        ]);
    }

    public function createTourSchedule(Tour $tour)
    {
        return inertia('admin/Tours/Schedules/Create', [
            'title' => 'Create Tour Schedule',
            'user' => Auth::user(),
            'tour' => $tour,
        ]);
    }

    public function storeTourSchedule(Request $request, Tour $tour)
    {
        $validated = $request->validate([
            'departure_date' => 'required|date',
            'return_date' => 'required|date|after_or_equal:departure_date',
            'departure_time' => 'required|date_format:H:i',
            'departure_point' => 'required|string|max:255',
            'total_seats' => 'required|integer|min:1',
            'price_override' => 'nullable|numeric|min:0',
            'child_price_override' => 'nullable|numeric|min:0',
            'status' => 'required|in:open,sold_out,closed,cancelled,completed',
            'notes' => 'nullable|string|max:2000',
        ]);

        $tour->schedules()->create($validated);

        return redirect()->route('admin.tours.schedules', $tour)->with('success', 'Tour schedule created.');
    }

    public function updateTourSchedule(Request $request, Tour $tour, TourSchedule $schedule)
    {
        $validated = $request->validate([
            'amendment_reason' => 'required|string|max:2000',
            'departure_date' => 'required|date',
            'return_date' => 'required|date|after_or_equal:departure_date',
            'departure_time' => 'required|date_format:H:i',
            'departure_point' => 'required|string|max:255',
            'total_seats' => 'required|integer|min:1',
            'price_override' => 'nullable|numeric|min:0',
            'child_price_override' => 'nullable|numeric|min:0',
            'status' => 'required|in:open,sold_out,closed,cancelled,completed',
            'notes' => 'nullable|string|max:2000',
        ]);

        abort_unless((int) $schedule->tour_id === (int) $tour->id, 404);
        $reason = $validated['amendment_reason'];
        unset($validated['amendment_reason']);
        \Illuminate\Support\Facades\DB::transaction(function () use ($schedule, $validated, $reason, $request) {
            $schedule = TourSchedule::lockForUpdate()->findOrFail($schedule->id);
            $before = $schedule->only(array_keys($validated));
            if ($schedule->departure_time === $validated['departure_time'].':00') {
                $validated['departure_time'] = $schedule->departure_time;
            }
            if ($validated['total_seats'] < $schedule->booked_seats + $schedule->reserved_seats) {
                throw \Illuminate\Validation\ValidationException::withMessages(['total_seats' => 'Capacity cannot be below booked and reserved seats.']);
            }
            $schedule->fill($validated);
            if ($schedule->hasBookingHistory() && $schedule->isDirty(['departure_date', 'return_date', 'departure_time', 'departure_point', 'price_override', 'child_price_override', 'status'])) {
                throw \Illuminate\Validation\ValidationException::withMessages(['schedule' => 'This departure has bookings. Resolve customer amendments or cancellations before changing its dates, pricing, pickup, or status.']);
            }
            $schedule->save();
            if ($schedule->wasChanged()) {
                $schedule->auditLogs()->create(['admin_id' => $request->user()->id, 'action' => 'schedule.updated',
                    'before' => $before, 'after' => $schedule->only(array_keys($validated)), 'note' => $reason]);
            }
        });

        return redirect()->back()->with('success', 'Tour schedule updated.');
    }

    public function deleteTourSchedule(Tour $tour, TourSchedule $schedule)
    {
        abort_unless((int) $schedule->tour_id === (int) $tour->id, 404);
        \Illuminate\Support\Facades\DB::transaction(function () use ($schedule) {
            $schedule = TourSchedule::lockForUpdate()->findOrFail($schedule->id);
            abort_if($schedule->hasBookingHistory(), 422, 'Departures with booking history cannot be deleted.');
            $schedule->delete();
        });

        return redirect()->back()->with('success', 'Tour schedule deleted.');
    }

    public function tourManifest(Request $request, Tour $tour, TourSchedule $schedule)
    {
        abort_unless((int) $schedule->tour_id === (int) $tour->id, 404);
        $bookings = $schedule->bookings()->whereNotIn('status', ['cancelled'])->orderBy('id')
            ->get(['id', 'booking_number', 'customer_name', 'customer_phone', 'number_of_adults', 'number_of_children', 'status']);
        if ($request->boolean('download')) {
            return response()->streamDownload(function () use ($bookings) {
                $stream = fopen('php://output', 'w');
                fputcsv($stream, ['Booking', 'Lead traveller', 'Phone', 'Adults', 'Children', 'Status'], ',', '"', '');
                foreach ($bookings as $booking) {
                    $values = [$booking->booking_number, $booking->customer_name, $booking->customer_phone, $booking->number_of_adults, $booking->number_of_children, $booking->status];
                    $values = array_map(fn ($value) => preg_match('/^[=+@\-\t\r]/', (string) $value) ? "'".$value : $value, $values);
                    fputcsv($stream, $values, ',', '"', '');
                }
                fclose($stream);
            }, 'departure-'.$schedule->id.'-manifest.csv', ['Content-Type' => 'text/csv']);
        }

        return inertia('admin/Tours/Manifest', ['tour' => $tour->only('id', 'title'), 'schedule' => $schedule->only('id', 'departure_date'), 'bookings' => $bookings]);
    }

    public function assignDriverToSchedule(Request $request, Tour $tour, TourSchedule $schedule)
    {
        $validated = $request->validate([
            'driver_id' => 'required|exists:drivers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'role' => 'nullable|in:transport,lead,assistant',
        ]);

        $driver = Driver::findOrFail($validated['driver_id']);
        $role = $validated['role'] ?? 'transport';
        $vehicleId = isset($validated['vehicle_id']) ? (int) $validated['vehicle_id'] : null;

        return DB::transaction(function () use ($request, $schedule, $driver, $role, $vehicleId) {
            app(\App\Services\ResourceCommitmentService::class)->lockResources($driver->id, $vehicleId);
            $schedule = TourSchedule::lockForUpdate()->findOrFail($schedule->id);

            $eligibilityFailures = app(DriverDispatchService::class)->eligibilityFailures(
                $driver,
                'tour',
                $role,
                null,
                $vehicleId
            );

            if ($eligibilityFailures !== []) {
                if ($request->wantsJson()) {
                    return response()->json([
                        'message' => implode(' ', $eligibilityFailures),
                        'errors' => ['driver_id' => $eligibilityFailures],
                    ], 422);
                }

                return redirect()->back()->with('error', implode(' ', $eligibilityFailures));
            }

            $existingAssignment = $schedule->driverAssignments()->where('driver_id', $driver->id)->first();
            $conflicts = app(\App\Services\ResourceCommitmentService::class)->findConflicts(
                $driver->id,
                $vehicleId,
                $schedule->departure_date,
                $schedule->return_date ?? $schedule->departure_date,
                [
                    'exclude_tour_assignment_id' => $existingAssignment?->id,
                    'exclude_tour_schedule_id' => $schedule->id,
                ]
            );

            if (! empty($conflicts)) {
                $errorMsg = implode(' ', $conflicts);
                if ($request->wantsJson()) {
                    return response()->json([
                        'message' => $errorMsg,
                        'errors' => ['driver_id' => $conflicts],
                    ], 422);
                }

                return redirect()->back()->with('error', $errorMsg);
            }

            $schedule->driverAssignments()->updateOrCreate(
                ['driver_id' => $driver->id],
                [
                    'vehicle_id' => $vehicleId,
                    'role' => $role,
                    'status' => 'assigned',
                ]
            );

            if ($request->wantsJson()) {
                return response()->json([
                    'message' => 'Driver assigned to tour successfully.',
                    'assignment' => $schedule->driverAssignments()->where('driver_id', $driver->id)->with(['driver', 'vehicle'])->first(),
                ]);
            }

            return redirect()->back()->with('success', 'Driver assigned to tour.');
        });
    }

    /**
     * Places management
     */
    public function places()
    {
        return inertia('admin/Places', [
            'title' => 'Place Management',
            'user' => Auth::user(),
            'places' => Place::with('media')->paginate(12),
        ]);
    }

    /**
     * Show create place form
     */
    public function createPlace()
    {
        return inertia('admin/Places/Create', [
            'title' => 'Create Place',
            'user' => Auth::user(),
        ]);
    }

    /**
     * Store new place
     */
    public function storePlace(Request $request, GooglePlaceDetailsService $googlePlaces)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'location' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:80',
            'google_place_id' => 'nullable|string|max:255',
            'google_rating' => 'nullable|numeric|min:0|max:5',
            'google_review_count' => 'nullable|integer|min:0',
            'is_active' => 'required|boolean',
            'is_featured' => 'required|boolean',
        ]);

        $place = Place::create([
            ...$validated,
            'slug' => $this->uniquePlaceSlug($validated['name']),
            'country' => ($validated['country'] ?? null) ?: 'India',
            'tags' => $validated['tags'] ?? [],
            'google_review_count' => $validated['google_review_count'] ?? 0,
        ]);

        if ($place->google_place_id) {
            $googlePlaces->sync($place, true);
        }

        return redirect()->route('admin.places')->with('success', 'Place created successfully');
    }

    /**
     * Show place details
     */
    public function showPlace(Place $place)
    {
        return inertia('admin/Places/Show', [
            'title' => 'Place Details',
            'user' => Auth::user(),
            'place' => $place->load(['media.customer:id,name,phone', 'media.reviewer:id,name', 'reviews.customer:id,name']),
        ]);
    }

    public function syncPlaceGoogleData(Place $place, GooglePlaceDetailsService $googlePlaces)
    {
        $result = $googlePlaces->sync($place, true);

        $statusCode = $result['status'] === 'failed' ? 422 : 200;

        if (request()->expectsJson()) {
            return response()->json([
                'success' => $result['status'] !== 'failed',
                'status' => $result['status'],
                'message' => $result['message'],
                'place' => $place->fresh(['media', 'reviews.customer:id,name']),
            ], $statusCode);
        }

        return redirect()->route('admin.places.show', $place)
            ->with($result['status'] === 'failed' ? 'error' : 'success', $result['message']);
    }

    /**
     * Show edit place form
     */
    public function editPlace(Place $place)
    {
        return inertia('admin/Places/Edit', [
            'title' => 'Edit Place',
            'user' => Auth::user(),
            'place' => $place,
        ]);
    }

    /**
     * Update place
     */
    public function updatePlace(Request $request, Place $place, GooglePlaceDetailsService $googlePlaces)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'location' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:80',
            'google_place_id' => 'nullable|string|max:255',
            'google_rating' => 'nullable|numeric|min:0|max:5',
            'google_review_count' => 'nullable|integer|min:0',
            'is_active' => 'required|boolean',
            'is_featured' => 'required|boolean',
        ]);

        $place->update([
            ...$validated,
            'slug' => $place->name !== $validated['name']
                ? $this->uniquePlaceSlug($validated['name'], $place->id)
                : $place->slug,
            'country' => ($validated['country'] ?? null) ?: 'India',
            'tags' => $validated['tags'] ?? [],
            'google_review_count' => $validated['google_review_count'] ?? 0,
        ]);

        if ($place->google_place_id && ($place->wasChanged(['google_place_id', 'latitude', 'longitude']) || ! $place->google_synced_at)) {
            $googlePlaces->sync($place, true);
        }

        return redirect()->route('admin.places')->with('success', 'Place updated successfully');
    }

    /**
     * Delete place
     */
    public function deletePlace(Place $place)
    {
        $place->delete();

        return redirect()->route('admin.places')->with('success', 'Place deleted successfully');
    }

    /**
     * Store new media for a place
     */
    public function storeMedia(Request $request, Place $place)
    {
        $validated = $request->validate([
            'file' => ['nullable', 'required_without:url', 'file', 'mimes:jpeg,png,jpg,gif,svg,mp4,avi,mov', 'max:20480', new FileIsClean],
            'url' => 'nullable|required_without:file|url:http,https|max:2048',
            'type' => 'required|in:image,panorama,video',
            'caption' => 'nullable|string|max:500',
        ]);

        if ($request->hasFile('file')) {
            $isVideo = str_starts_with($request->file('file')->getMimeType(), 'video/');
            if (($validated['type'] === 'video') !== $isVideo) {
                return back()->withErrors(['type' => $isVideo
                    ? 'Video files must use the Video media type.'
                    : 'Image files must use Image or 360° panorama.'])->withInput();
            }

        }

        $filePath = $request->hasFile('file')
            ? $request->file('file')->store('place_media', 'public')
            : $validated['url'];

        PlaceMedia::create([
            'place_id' => $place->id,
            'path' => $filePath,
            'type' => $validated['type'],
            'source' => 'admin',
            'approval_status' => 'approved',
            'reviewed_by' => Auth::id(),
            'reviewed_at' => now(),
            'caption' => $validated['caption'] ?? null,
        ]);

        return redirect()->route('admin.places.show', $place->id)->with('success', 'Media added successfully');
    }

    /**
     * Delete media
     */
    public function deleteMedia(PlaceMedia $media)
    {
        if (! MediaUrl::isExternal($media->path)) {
            Storage::disk('public')->delete(ltrim(str_replace('storage/', '', $media->path), '/'));
        }
        $media->delete();

        return redirect()->route('admin.places.show', $media->place_id)->with('success', 'Media deleted successfully');
    }

    public function approveMedia(PlaceMedia $media)
    {
        $media->update([
            'approval_status' => 'approved',
            'reviewed_by' => Auth::id(),
            'reviewed_at' => now(),
            'rejection_reason' => null,
        ]);

        return back()->with('success', 'Customer photo approved and published.');
    }

    public function rejectMedia(Request $request, PlaceMedia $media)
    {
        $validated = $request->validate(['reason' => 'required|string|max:1000']);
        $media->update([
            'approval_status' => 'rejected',
            'reviewed_by' => Auth::id(),
            'reviewed_at' => now(),
            'rejection_reason' => $validated['reason'],
        ]);

        return back()->with('success', 'Customer photo rejected and kept out of public galleries.');
    }

    private function uniquePlaceSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'place';
        $slug = $base;
        $counter = 2;

        while (Place::where('slug', $slug)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $slug = "{$base}-{$counter}";
            $counter++;
        }

        return $slug;
    }

    /**
     * System settings
     */
    public function settings()
    {
        return inertia('admin/Settings', [
            'title' => 'System Settings',
            'user' => Auth::user(),
            'settings' => [
                'site_name' => 'Turiya Mobility',
                'site_description' => 'Tours - Rides - Rentals',
                'contact_email' => 'info@travelagency.com',
                'contact_phone' => '+1 (555) 123-4567',
                'address' => '123 Main St, City, State',
                'social_links' => [
                    'facebook' => 'https://facebook.com/travelagency',
                    'twitter' => 'https://twitter.com/travelagency',
                    'instagram' => 'https://instagram.com/travelagency',
                ],
            ],
        ]);
    }

    /**
     * Car rentals management
     */
    public function carRentals(Request $request)
    {
        $query = CarRental::with(['carCategory', 'customer', 'driver', 'vehicle']);

        // Filter by status if provided
        if ($request->has('status') && ! empty($request->status)) {
            $query->where('status', $request->status);
        }

        if ($request->has('dispatch_status') && ! empty($request->dispatch_status)) {
            $query->where('dispatch_status', $request->dispatch_status);
        }

        if ($request->boolean('admin_assignable')) {
            $query->where('admin_assignable', true);
        }

        $carRentals = $query->orderBy('created_at', 'desc')->paginate(12);

        // Return JSON if it's an API request
        if ($request->expectsJson()) {
            return response()->json($carRentals);
        }

        return redirect()->route('admin.bookings', array_merge($request->query(), ['tab' => 'rental']));
    }

    /**
     * Show create car rental form
     */
    public function createCarRental()
    {
        $carCategories = CarCategory::where('is_active', true)->orderBy('name')->get();
        $destinations = Destination::where('is_active', true)->orderBy('name')->get();
        $drivers = Driver::query()
            ->where('status', 'active')
            ->where('is_active', true)
            ->where('is_approved', true)
            ->where('can_rental_delivery', true)
            ->orderBy('name')
            ->get();
        $vehicles = Vehicle::query()
            ->where('is_active', true)
            ->orderBy('registration_number')
            ->get();

        return inertia('admin/CarRentals/Create', [
            'title' => 'Create Car Rental',
            'user' => Auth::user(),
            'car_categories' => $carCategories,
            'destinations' => $destinations,
            'drivers' => $drivers,
            'vehicles' => $vehicles,
        ]);
    }

    /**
     * Store new car rental
     */
    public function storeCarRental(Request $request)
    {
        $validated = $request->validate([
            'car_category_id' => 'required|exists:car_categories,id',
            'customer_name' => 'required|string|max:255',
            'customer_email' => 'required|email|max:255',
            'customer_phone' => 'required|string|max:20',
            'customer_address' => 'nullable|string',
            'start_date' => 'required|date|after:today',
            'end_date' => 'required|date|after_or_equal:start_date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'pickup_location' => 'required|string|max:255',
            'dropoff_location' => 'nullable|string|max:255',
            'destination_details' => 'nullable|string',
            'distance_km' => 'nullable|numeric|min:0',
            'special_requests' => 'nullable|string',
            'status' => 'required|in:pending,confirmed,driver_assigned,in_progress,completed,cancelled',
            'payment_status' => 'required|in:pending,paid,failed,refunded',
            'payment_method' => 'required|in:cash,card,bank_transfer,upi',
            'driver_id' => 'nullable|exists:drivers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'internal_notes' => 'nullable|string',
            'whatsapp_notification' => 'boolean',
            'email_notification' => 'boolean',
            'sms_notification' => 'boolean',
        ]);

        // Calculate pricing
        $carCategory = CarCategory::findOrFail($validated['car_category_id']);
        $startDate = \Carbon\Carbon::parse($validated['start_date']);
        $endDate = \Carbon\Carbon::parse($validated['end_date']);
        $numberOfDays = $startDate->diffInDays($endDate) + 1;
        $distanceKm = $validated['distance_km'] ?? 0;

        $pricing = $carCategory->calculatePrice($numberOfDays, $distanceKm);

        $customer = Customer::firstOrCreate(
            ['phone' => $validated['customer_phone']],
            [
                'name' => $validated['customer_name'],
                'email' => $validated['customer_email'],
                'is_active' => true,
            ]
        );

        $carRental = CarRental::create([
            'booking_number' => CarRental::generateBookingNumber(),
            'customer_id' => $customer->id,
            'car_category_id' => $validated['car_category_id'],
            'customer_name' => $validated['customer_name'],
            'customer_email' => $validated['customer_email'],
            'customer_phone' => $validated['customer_phone'],
            'customer_address' => $validated['customer_address'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'start_time' => $validated['start_time'] ?? '09:00',
            'end_time' => $validated['end_time'] ?? '18:00',
            'pickup_location' => $validated['pickup_location'],
            'dropoff_location' => $validated['dropoff_location'],
            'destination_details' => $validated['destination_details'],
            'number_of_days' => $numberOfDays,
            'base_price' => $pricing['base_price'],
            'distance_km' => $distanceKm,
            'distance_price' => $pricing['distance_price'],
            'extras_price' => 0,
            'discount_amount' => 0,
            'total_price' => $pricing['subtotal'],
            'status' => $validated['driver_id'] && $validated['status'] === 'confirmed'
                ? 'driver_assigned'
                : $validated['status'],
            'payment_status' => $validated['payment_status'],
            'payment_method' => $validated['payment_method'],
            'special_requests' => $validated['special_requests'],
            'driver_id' => $validated['driver_id'] ?? null,
            'vehicle_id' => $validated['vehicle_id'] ?? null,
            'internal_notes' => $validated['internal_notes'],
            'whatsapp_notification' => $request->boolean('whatsapp_notification', true),
            'email_notification' => $request->boolean('email_notification', true),
            'sms_notification' => $request->boolean('sms_notification', false),
        ]);

        if (! empty($validated['driver_id'])) {
            DriverAvailability::where('driver_id', $validated['driver_id'])->update([
                'status' => 'on_ride',
                'is_available' => false,
                'last_updated' => now(),
            ]);
        }

        return redirect()->route('admin.bookings', ['tab' => 'rental'])->with('success', 'Car rental created successfully');
    }

    /**
     * Show car rental details
     */
    public function showCarRental(CarRental $carRental)
    {
        $carRental->load([
            'carCategory',
            'customer',
            'driver',
            'vehicle',
            'extras',
            'refunds.customer:id,name,phone',
            'refunds.walletTransaction',
            'incidents.customer:id,name,phone',
            'incidents.driver:id,name,phone',
            'auditLogs.admin:id,name,email',
            'reviews.customer:id,name',
            'reviews.driver:id,name',
        ]);

        return inertia('admin/CarRentals/Show', [
            'title' => 'Car Rental Details',
            'user' => Auth::user(),
            'car_rental' => $carRental,
            'drivers' => Driver::query()
                ->where('status', 'active')
                ->where('is_active', true)
                ->where('is_approved', true)
                ->where('can_rental_delivery', true)
                ->orderBy('name')
                ->get(['id', 'name', 'phone', 'rating', 'vehicle_number']),
            'vehicles' => Vehicle::query()
                ->where('is_active', true)
                ->orderBy('registration_number')
                ->get(['id', 'driver_id', 'car_category_id', 'registration_number', 'make', 'model']),
        ]);
    }

    /**
     * Show edit car rental form
     */
    public function editCarRental(CarRental $carRental)
    {
        $carRental->load(['carCategory', 'customer', 'driver', 'vehicle']);
        $carCategories = CarCategory::where('is_active', true)->orderBy('name')->get();
        $destinations = Destination::where('is_active', true)->orderBy('name')->get();
        $drivers = Driver::query()
            ->where('status', 'active')
            ->where('is_active', true)
            ->where('is_approved', true)
            ->where('can_rental_delivery', true)
            ->orderBy('name')
            ->get();
        $vehicles = Vehicle::query()
            ->where('is_active', true)
            ->orderBy('registration_number')
            ->get();

        return inertia('admin/CarRentals/Edit', [
            'title' => 'Edit Car Rental',
            'user' => Auth::user(),
            'car_rental' => $carRental,
            'car_categories' => $carCategories,
            'destinations' => $destinations,
            'drivers' => $drivers,
            'vehicles' => $vehicles,
        ]);
    }

    /**
     * Update car rental
     */
    public function updateCarRental(Request $request, CarRental $carRental)
    {
        $validated = $request->validate([
            'car_category_id' => 'required|exists:car_categories,id',
            'customer_name' => 'required|string|max:255',
            'customer_email' => 'required|email|max:255',
            'customer_phone' => 'required|string|max:20',
            'customer_address' => 'nullable|string',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'pickup_location' => 'required|string|max:255',
            'dropoff_location' => 'nullable|string|max:255',
            'destination_details' => 'nullable|string',
            'distance_km' => 'nullable|numeric|min:0',
            'special_requests' => 'nullable|string',
            'status' => 'required|in:pending,confirmed,driver_assigned,in_progress,completed,cancelled',
            'payment_status' => 'required|in:pending,paid,failed,refunded',
            'payment_method' => 'required|in:cash,card,bank_transfer,upi',
            'driver_id' => 'nullable|exists:drivers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'internal_notes' => 'nullable|string',
            'whatsapp_notification' => 'boolean',
            'email_notification' => 'boolean',
            'sms_notification' => 'boolean',
        ]);

        // Recalculate pricing if dates or category changed
        $carCategory = CarCategory::findOrFail($validated['car_category_id']);
        $startDate = \Carbon\Carbon::parse($validated['start_date']);
        $endDate = \Carbon\Carbon::parse($validated['end_date']);
        $numberOfDays = $startDate->diffInDays($endDate) + 1;
        $distanceKm = $validated['distance_km'] ?? 0;

        $pricing = $carCategory->calculatePrice($numberOfDays, $distanceKm);

        $customer = Customer::updateOrCreate(
            ['phone' => $validated['customer_phone']],
            [
                'name' => $validated['customer_name'],
                'email' => $validated['customer_email'],
                'is_active' => true,
            ]
        );

        $previousDriverId = $carRental->driver_id;

        $carRental->update([
            'customer_id' => $customer->id,
            'car_category_id' => $validated['car_category_id'],
            'customer_name' => $validated['customer_name'],
            'customer_email' => $validated['customer_email'],
            'customer_phone' => $validated['customer_phone'],
            'customer_address' => $validated['customer_address'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'start_time' => $validated['start_time'],
            'end_time' => $validated['end_time'],
            'pickup_location' => $validated['pickup_location'],
            'dropoff_location' => $validated['dropoff_location'],
            'destination_details' => $validated['destination_details'],
            'number_of_days' => $numberOfDays,
            'base_price' => $pricing['base_price'],
            'distance_km' => $distanceKm,
            'distance_price' => $pricing['distance_price'],
            'total_price' => $pricing['subtotal'],
            'special_requests' => $validated['special_requests'],
            'status' => $validated['status'],
            'payment_status' => $validated['payment_status'],
            'payment_method' => $validated['payment_method'],
            'driver_id' => $validated['driver_id'] ?? null,
            'vehicle_id' => $validated['vehicle_id'] ?? null,
            'internal_notes' => $validated['internal_notes'],
            'whatsapp_notification' => $request->boolean('whatsapp_notification', $carRental->whatsapp_notification),
            'email_notification' => $request->boolean('email_notification', $carRental->email_notification),
            'sms_notification' => $request->boolean('sms_notification', $carRental->sms_notification),
        ]);

        $this->syncDriverAvailabilityForRental($carRental, $previousDriverId);

        return redirect()->route('admin.bookings', ['tab' => 'rental'])->with('success', 'Car rental updated successfully');
    }

    /**
     * Delete car rental
     */
    public function deleteCarRental(CarRental $carRental)
    {
        $carRental->delete();

        return redirect()->route('admin.bookings', ['tab' => 'rental'])->with('success', 'Car rental deleted successfully');
    }

    public function assignCarRentalDriver(Request $request, CarRental $carRental)
    {
        $validated = $request->validate([
            'driver_id' => 'required|exists:drivers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
        ]);

        $driver = Driver::findOrFail($validated['driver_id']);
        $vehicleId = isset($validated['vehicle_id']) ? (int) $validated['vehicle_id'] : null;

        try {
            $updatedRental = app(RentalDriverService::class)->assignDriver(
                $carRental,
                $driver,
                $vehicleId,
                $request->user()?->id
            );

            return response()->json([
                'message' => 'Rental driver assigned successfully.',
                'car_rental' => $updatedRental,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        }
    }

    public function carRentalCandidates(CarRental $carRental)
    {
        $candidates = app(RentalDriverService::class)->getRankedCandidates($carRental);

        return response()->json([
            'success' => true,
            'data' => $candidates,
        ]);
    }

    public function updateCarRentalStatus(Request $request, CarRental $carRental)
    {
        $validated = $request->validate([
            'status' => 'nullable|in:pending,confirmed,driver_assigned,in_progress,completed,cancelled',
            'payment_status' => 'nullable|in:pending,paid,failed,refunded',
            'cancellation_reason' => 'nullable|string|max:1000',
        ]);

        if (! isset($validated['status']) && ! isset($validated['payment_status'])) {
            return response()->json(['message' => 'No changes requested.'], 422);
        }

        $previousDriverId = $carRental->driver_id;
        $before = $this->bookingAuditSnapshot($carRental);
        $statusService = app(BookingStatusService::class);
        $cancellationService = app(BookingCancellationService::class);

        $updates = [];
        if (isset($validated['status'])) {
            $requestedStatus = $statusService->normalize(BookingStatusService::RENTAL, $validated['status']);
            if (! $requestedStatus || ! $statusService->canTransition(BookingStatusService::RENTAL, $carRental->status, $requestedStatus, 'admin')) {
                return response()->json([
                    'message' => 'Invalid rental status transition.',
                    'allowed_transitions' => $statusService->allowedTransitions(BookingStatusService::RENTAL, $carRental->status, 'admin'),
                ], 422);
            }

            if ($requestedStatus === 'cancelled') {
                $refund = $cancellationService->cancel(
                    $carRental,
                    BookingStatusService::RENTAL,
                    $validated['cancellation_reason'] ?? null,
                    Auth::id()
                );
                $this->recordBookingAudit($carRental->fresh(), 'cancelled', $before, $this->bookingAuditSnapshot($carRental->fresh()), $validated['cancellation_reason'] ?? null);
                $this->syncDriverAvailabilityForRental($carRental->fresh(), $previousDriverId);
                $this->notifyBookingLifecycle($carRental->fresh('customer'), 'booking.cancelled');
                if ($refund?->status === 'processed') {
                    $this->notifyBookingLifecycle($carRental->fresh('customer'), 'refund.processed', ['refund_id' => $refund->id]);
                }

                return response()->json([
                    'message' => 'Car rental cancelled successfully.',
                    'car_rental' => $carRental->fresh(['driver:id,name,email,phone', 'vehicle', 'refunds']),
                ]);
            }

            $updates['status'] = $requestedStatus;
        }
        if (isset($validated['payment_status'])) {
            $updates['payment_status'] = $validated['payment_status'];
        }

        $carRental->update($updates);
        if (($updates['status'] ?? null) === 'completed' && $carRental->fresh()->payment_status === 'paid') {
            app(CommissionService::class)->settleRental($carRental->fresh());
        }
        $this->recordBookingAudit($carRental->fresh(), 'status_updated', $before, $this->bookingAuditSnapshot($carRental->fresh()));
        $this->syncDriverAvailabilityForRental($carRental, $previousDriverId);
        $this->notifyStatusAndPaymentLifecycle($carRental->fresh('customer'), $updates);

        return response()->json([
            'message' => 'Car rental updated successfully.',
            'car_rental' => $carRental->fresh(['driver:id,name,email,phone', 'vehicle']),
        ]);
    }

    public function confirmCarRentalPayment(Request $request, CarRental $carRental)
    {
        return $this->confirmBookingPayment($request, $carRental, 'car_rental');
    }

    /**
     * Preview extra charges for a completed rental without persisting.
     */
    public function previewRentalSettlement(Request $request, CarRental $carRental)
    {
        $validated = $request->validate([
            'actual_km' => 'nullable|numeric|min:0',
            'actual_return_at' => 'nullable|date',
            'surcharge_items' => 'nullable|array',
            'surcharge_items.*.name' => 'required_with:surcharge_items|string|max:120',
            'surcharge_items.*.amount' => 'required_with:surcharge_items|numeric|min:0',
        ]);

        $preview = app(\App\Services\RentalSettlementService::class)->preview($carRental, $validated);

        return response()->json([
            'message' => 'Settlement preview computed.',
            'data' => $preview,
        ]);
    }

    /**
     * Apply settlement charges to a completed rental.
     */
    public function settleRental(Request $request, CarRental $carRental)
    {
        $validated = $request->validate([
            'actual_km' => 'nullable|numeric|min:0',
            'actual_return_at' => 'nullable|date',
            'surcharge_items' => 'nullable|array',
            'surcharge_items.*.name' => 'required_with:surcharge_items|string|max:120',
            'surcharge_items.*.amount' => 'required_with:surcharge_items|numeric|min:0',
            'notes' => 'nullable|string|max:2000',
        ]);

        $settled = app(\App\Services\RentalSettlementService::class)->settle(
            $carRental,
            $validated,
            Auth::id()
        );

        return response()->json([
            'message' => 'Rental settlement applied successfully.',
            'car_rental' => $settled->fresh(['driver:id,name,email,phone', 'vehicle', 'extras']),
        ]);
    }

    public function updateTourBookingStatus(Request $request, TourBooking $tourBooking)
    {
        $validated = $request->validate([
            'status' => 'nullable|in:pending,confirmed,in_progress,completed,cancelled',
            'payment_status' => 'nullable|in:pending,partial,paid,refunded',
            'cancellation_reason' => 'nullable|string|max:1000',
        ]);

        if (! isset($validated['status']) && ! isset($validated['payment_status'])) {
            return response()->json(['message' => 'No changes requested.'], 422);
        }

        $statusService = app(BookingStatusService::class);

        DB::transaction(function () use ($tourBooking, $validated) {
            $tourBooking = TourBooking::lockForUpdate()->findOrFail($tourBooking->id);
            $before = $this->bookingAuditSnapshot($tourBooking);

            $updates = [];
            if (isset($validated['status'])) {
                $statusService = app(BookingStatusService::class);
                $requestedStatus = $statusService->normalize(BookingStatusService::TOUR, $validated['status']);
                if (! $requestedStatus || ! $statusService->canTransition(BookingStatusService::TOUR, $tourBooking->status, $requestedStatus, 'admin')) {
                    abort(response()->json([
                        'message' => 'Invalid tour booking status transition.',
                        'allowed_transitions' => $statusService->allowedTransitions(BookingStatusService::TOUR, $tourBooking->status, 'admin'),
                    ], 422));
                }

                if ($requestedStatus === 'cancelled') {
                    $refund = app(BookingCancellationService::class)->cancel(
                        $tourBooking,
                        BookingStatusService::TOUR,
                        $validated['cancellation_reason'] ?? null,
                        Auth::id()
                    );
                    $this->recordBookingAudit($tourBooking->fresh(), 'cancelled', $before, $this->bookingAuditSnapshot($tourBooking->fresh()), $validated['cancellation_reason'] ?? null);
                    $this->notifyBookingLifecycle($tourBooking->fresh('customer'), 'booking.cancelled');
                    if ($refund?->status === 'processed') {
                        $this->notifyBookingLifecycle($tourBooking->fresh('customer'), 'refund.processed', ['refund_id' => $refund->id]);
                    }

                    return;
                }

                $updates['status'] = $requestedStatus;
            }
            if (isset($validated['payment_status'])) {
                abort_unless($validated['payment_status'] === $tourBooking->payment_status, 422, 'Use payment confirmation or the refund workflow to change payment status.');
            }
            if (($updates['status'] ?? null) === 'confirmed') {
                abort_unless($tourBooking->payment_status === 'paid', 422, 'Confirm the payment before confirming the booking.');
                app(\App\Services\PaymentService::class)->confirmTourBooking($tourBooking);
            }

            $tourBooking->update($updates);
            if (($updates['status'] ?? null) === 'completed' && ($tourBooking->payment_plan || $tourBooking->fresh()->payment_status === 'paid')) {
                app(CommissionService::class)->settleTour($tourBooking->fresh());
            }
            $this->recordBookingAudit($tourBooking->fresh(), 'status_updated', $before, $this->bookingAuditSnapshot($tourBooking->fresh()));
            $this->notifyStatusAndPaymentLifecycle($tourBooking->fresh('customer'), $updates);
        });

        return response()->json([
            'message' => 'Tour booking updated successfully.',
            'tour_booking' => $tourBooking->fresh(['customer', 'tour', 'schedule', 'refunds']),
        ]);
    }

    public function confirmTourBookingPayment(Request $request, TourBooking $tourBooking)
    {
        return $this->confirmBookingPayment($request, $tourBooking, 'tour_booking');
    }

    private function syncDriverAvailabilityForRental(CarRental $carRental, ?int $previousDriverId = null): void
    {
        if ($previousDriverId && $previousDriverId !== $carRental->driver_id) {
            DriverAvailability::where('driver_id', $previousDriverId)->update([
                'status' => 'online',
                'is_available' => true,
                'last_updated' => now(),
            ]);
        }

        if (! $carRental->driver_id) {
            return;
        }

        $isActiveRental = in_array($carRental->status, ['driver_assigned', 'in_progress'], true);

        DriverAvailability::where('driver_id', $carRental->driver_id)->update([
            'status' => $isActiveRental ? 'on_ride' : 'online',
            'is_available' => ! $isActiveRental,
            'last_updated' => now(),
        ]);
    }

    public function carCategories(Request $request)
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

        $carCategories = $query->orderBy('sort_order')->orderBy('name')->paginate(12);

        return inertia('admin/CarCategories', [
            'title' => 'Car Categories Management',
            'user' => Auth::user(),
            'car_categories' => $carCategories,
        ]);
    }

    /**
     * Show create car category form
     */
    public function createCarCategory()
    {
        return inertia('admin/CarCategories/Create', [
            'title' => 'Create Car Category',
            'user' => Auth::user(),
        ]);
    }

    /**
     * Store new car category
     */
    public function storeCarCategory(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:car_categories,name',
            'description' => 'nullable|string',
            'vehicle_type' => 'required|string|in:sedan,suv,hatchback,convertible,van,truck',
            'seats' => 'required|integer|min:1|max:20',
            'has_ac' => 'boolean',
            'has_driver' => 'boolean',
            'base_price_per_day' => 'required|numeric|min:0',
            'included_km_per_day' => 'nullable|integer|min:0',
            'extra_km_charge' => 'nullable|numeric|min:0',
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

        $validated['extra_km_charge'] = $validated['extra_km_charge'] ?? 0;
        CarCategory::create($validated);

        return redirect()->route('admin.car-categories')->with('success', 'Car category created successfully');
    }

    /**
     * Show car category details
     */
    public function showCarCategory(CarCategory $carCategory)
    {
        return inertia('admin/CarCategories/Show', [
            'title' => 'Car Category Details',
            'user' => Auth::user(),
            'car_category' => $carCategory->load('carRentals'),
        ]);
    }

    /**
     * Show edit car category form
     */
    public function editCarCategory(CarCategory $carCategory)
    {
        return inertia('admin/CarCategories/Edit', [
            'title' => 'Edit Car Category',
            'user' => Auth::user(),
            'car_category' => $carCategory,
        ]);
    }

    /**
     * Update car category
     */
    public function updateCarCategory(Request $request, CarCategory $carCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:car_categories,name,'.$carCategory->id,
            'description' => 'nullable|string',
            'vehicle_type' => 'required|string|in:sedan,suv,hatchback,convertible,van,truck',
            'seats' => 'required|integer|min:1|max:20',
            'has_ac' => 'boolean',
            'has_driver' => 'boolean',
            'base_price_per_day' => 'required|numeric|min:0',
            'included_km_per_day' => 'nullable|integer|min:0',
            'extra_km_charge' => 'nullable|numeric|min:0',
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

        $validated['extra_km_charge'] = $validated['extra_km_charge'] ?? $carCategory->extra_km_charge ?? 0;
        $carCategory->update($validated);

        return redirect()->route('admin.car-categories')->with('success', 'Car category updated successfully');
    }

    /**
     * Delete car category
     */
    public function deleteCarCategory(CarCategory $carCategory)
    {
        // Check if there are any car rentals using this category
        if ($carCategory->carRentals()->count() > 0) {
            return back()->with('error', 'Cannot delete car category as it has associated car rentals');
        }

        $carCategory->delete();

        return redirect()->route('admin.car-categories')->with('success', 'Car category deleted successfully');
    }

    /**
     * Destinations management
     */
    public function destinations(Request $request)
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

        $destinations = $query->orderBy('sort_order')->orderBy('name')->paginate(12);

        return inertia('admin/Destinations', [
            'title' => 'Destinations Management',
            'user' => Auth::user(),
            'destinations' => $destinations,
        ]);
    }

    /**
     * Show create destination form
     */
    public function createDestination()
    {
        return inertia('admin/Destinations/Create', [
            'title' => 'Create Destination',
            'user' => Auth::user(),
        ]);
    }

    /**
     * Store new destination
     */
    public function storeDestination(Request $request)
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

        Destination::create($validated);

        return redirect()->route('admin.destinations')->with('success', 'Destination created successfully');
    }

    /**
     * Show destination details
     */
    public function showDestination(Destination $destination)
    {
        return inertia('admin/Destinations/Show', [
            'title' => 'Destination Details',
            'user' => Auth::user(),
            'destination' => $destination,
        ]);
    }

    /**
     * Show edit destination form
     */
    public function editDestination(Destination $destination)
    {
        return inertia('admin/Destinations/Edit', [
            'title' => 'Edit Destination',
            'user' => Auth::user(),
            'destination' => $destination,
        ]);
    }

    /**
     * Update destination
     */
    public function updateDestination(Request $request, Destination $destination)
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

        return redirect()->route('admin.destinations')->with('success', 'Destination updated successfully');
    }

    /**
     * Delete destination
     */
    public function deleteDestination(Destination $destination)
    {
        // Check if there are any tours using this destination
        if ($destination->tours()->count() > 0) {
            return back()->with('error', 'Cannot delete destination as it has associated tours');
        }

        $destination->delete();

        return redirect()->route('admin.destinations')->with('success', 'Destination deleted successfully');
    }

    /**
     * Ride bookings management
     */
    public function rideBookings(Request $request)
    {
        $query = RideBooking::with(['customer', 'driver']);

        // Filter by status if provided
        if ($request->has('status') && ! empty($request->status)) {
            $query->where('status', $request->status);
        }

        $rideBookings = $query->orderBy('created_at', 'desc')->paginate(12);

        // Return JSON if it's an API request
        if ($request->expectsJson()) {
            return response()->json($rideBookings);
        }

        return redirect()->route('admin.bookings', array_merge($request->query(), ['tab' => 'ride']));
    }

    /**
     * Show ride booking details for admin dashboard.
     */
    public function showRideBooking(RideBooking $rideBooking)
    {
        $rideBooking->load([
            'customer:id,name,email,phone',
            'driver:id,name,email,phone',
        ]);

        $drivers = Driver::query()
            ->select('id', 'name', 'email', 'phone')
            ->with('driverAvailability')
            ->orderBy('name')
            ->get()
            ->map(function ($driver) {
                $availability = $driver->driverAvailability;

                return [
                    'id' => $driver->id,
                    'name' => $driver->name,
                    'email' => $driver->email,
                    'phone' => $driver->phone,
                    'is_online' => ($availability?->status ?? 'offline') !== 'offline',
                    'is_available' => (bool) ($availability?->is_available ?? false),
                    'sharing_enabled' => (bool) ($availability?->sharing_enabled ?? false),
                    'sharing_seat_capacity' => (int) ($availability?->sharing_seat_capacity ?? 3),
                    'rating' => $driver->rating,
                    'vehicle_number' => $driver->vehicle_number,
                ];
            })->values();

        return inertia('admin/RideBookingDetails', [
            'title' => 'Ride Booking Details',
            'user' => Auth::user(),
            'booking' => $rideBooking,
            'drivers' => $drivers,
            'can_undo_last_change' => $this->canUndoLastChange($rideBooking),
        ]);
    }

    /**
     * Assign or reassign driver for ride booking.
     */
    public function assignRideBookingDriver(Request $request, RideBooking $rideBooking)
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'driver_id' => 'required|exists:drivers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $driver = Driver::findOrFail($validated['driver_id']);
        $dispatchService = app(DriverDispatchService::class);
        $vehicleId = isset($validated['vehicle_id']) ? (int) $validated['vehicle_id'] : ($rideBooking->vehicle_id ?: $driver->vehicle?->id);

        return DB::transaction(function () use ($rideBooking, $driver, $vehicleId, $dispatchService, $validated) {
            Customer::whereKey($rideBooking->customer_id)->lockForUpdate()->firstOrFail();
            app(\App\Services\ResourceCommitmentService::class)->lockResources($driver->id, $vehicleId);
            $rideBooking = RideBooking::lockForUpdate()->findOrFail($rideBooking->id);

            if (! in_array($rideBooking->status, ['pending', 'confirmed', 'driver_assigned', 'driver_arriving', 'pickup'], true)
                || (! $rideBooking->driver_id && $rideBooking->request_expires_at?->lte(now()))) {
                return response()->json(['message' => 'This ride is closed or its search deadline has passed.'], 409);
            }
            if ($rideBooking->request_expires_at && RideBooking::where('customer_id', $rideBooking->customer_id)->whereKeyNot($rideBooking->id)
                ->whereIn('status', ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'])->exists()) {
                return response()->json(['message' => 'The customer already has another accepted ride.'], 409);
            }

            $eligibilityFailures = $dispatchService->eligibilityFailures(
                $driver,
                $dispatchService->rideServiceType($rideBooking),
                null,
                $rideBooking->car_category_id ? (int) $rideBooking->car_category_id : null,
                $vehicleId,
                $rideBooking->pickup_lat !== null ? (float) $rideBooking->pickup_lat : null,
                $rideBooking->pickup_lng !== null ? (float) $rideBooking->pickup_lng : null,
                null,
                null,
                $rideBooking
            );

            if ($eligibilityFailures !== []) {
                return response()->json([
                    'message' => implode(' ', $eligibilityFailures),
                    'errors' => ['driver_id' => $eligibilityFailures],
                ], 422);
            }

            $commitmentService = app(\App\Services\ResourceCommitmentService::class);
            $rideInterval = $commitmentService->getRideInterval($rideBooking);
            $conflicts = $commitmentService->findConflicts(
                $driver->id,
                $vehicleId,
                $rideInterval['start'],
                $rideInterval['end'],
                [
                    'exclude_ride_booking_id' => $rideBooking->id,
                    'exact_interval' => true,
                ]
            );

            if (! empty($conflicts)) {
                return response()->json([
                    'message' => implode(' ', $conflicts),
                    'errors' => ['driver_id' => $conflicts],
                ], 422);
            }

            $previousDriverId = $rideBooking->driver_id;
            $newDriverId = (int) $validated['driver_id'];

            $this->captureAdminSnapshot($rideBooking);

            $rideBooking->update([
                'driver_id' => $newDriverId,
                'vehicle_id' => $vehicleId,
                'status' => in_array($rideBooking->status, ['completed', 'cancelled'], true)
                    ? $rideBooking->status
                    : 'driver_assigned',
                'dispatch_status' => 'assigned',
                'admin_assignable' => false,
                'start_ride_pin' => $rideBooking->start_ride_pin ?: RideBooking::generateStartRidePin(),
                'start_pin_verified_at' => null,
                'last_admin_changed_at' => now(),
                'last_admin_changed_by' => Auth::id(),
            ]);

            if ($previousDriverId && $previousDriverId !== $newDriverId) {
                $prevDriver = Driver::find($previousDriverId);
                if ($prevDriver && ! $dispatchService->hasActiveWorkload($prevDriver)) {
                    DriverAvailability::where('driver_id', $previousDriverId)->update([
                        'is_available' => true,
                        'status' => 'online',
                    ]);
                }
            }

            $isDueNow = $rideBooking->scheduled_at === null
                || $rideBooking->scheduled_at->lte(now()->addMinutes((int) setting('ride.dispatch.window_minutes', 15)));

            if ($isDueNow) {
                DriverAvailability::where('driver_id', $newDriverId)->update([
                    'is_available' => false,
                    'status' => 'on_ride',
                ]);
            }
            $this->notifyBookingLifecycle($rideBooking->fresh('customer'), 'driver.assigned', [
                'driver_id' => $newDriverId,
                'vehicle_id' => $vehicleId,
            ]);

            return response()->json([
                'message' => 'Driver assigned successfully.',
                'ride_booking' => $rideBooking->fresh(['driver:id,name,email,phone']),
            ]);
        });
    }

    public function updateRideBookingStatus(Request $request, RideBooking $rideBooking)
    {
        $validated = $request->validate([
            'status' => 'nullable|string|in:pending,confirmed,driver_assigned,driver_arriving,pickup,in_transit,completed,cancelled',
            'payment_status' => 'nullable|string|in:pending,paid,failed,refunded',
            'cancellation_reason' => 'nullable|string|max:1000',
        ]);

        if (! isset($validated['status']) && ! isset($validated['payment_status'])) {
            return response()->json([
                'message' => 'No changes requested.',
            ], 422);
        }

        $this->captureAdminSnapshot($rideBooking);
        $before = $this->bookingAuditSnapshot($rideBooking);
        $statusService = app(BookingStatusService::class);

        $updateData = [
            'last_admin_changed_at' => now(),
            'last_admin_changed_by' => Auth::id(),
        ];

        if (isset($validated['status'])) {
            $requestedStatus = $statusService->normalize(BookingStatusService::RIDE, $validated['status']);
            if (! $requestedStatus || ! $statusService->canTransition(BookingStatusService::RIDE, $rideBooking->status, $requestedStatus, 'admin')) {
                return response()->json([
                    'message' => 'Invalid ride booking status transition.',
                    'allowed_transitions' => $statusService->allowedTransitions(BookingStatusService::RIDE, $rideBooking->status, 'admin'),
                ], 422);
            }

            if ($requestedStatus === 'cancelled') {
                $refund = app(BookingCancellationService::class)->cancel(
                    $rideBooking,
                    BookingStatusService::RIDE,
                    $validated['cancellation_reason'] ?? null,
                    Auth::id()
                );

                $rideBooking->update($updateData);
                $this->recordBookingAudit($rideBooking->fresh(), 'cancelled', $before, $this->bookingAuditSnapshot($rideBooking->fresh()), $validated['cancellation_reason'] ?? null);
                $this->notifyBookingLifecycle($rideBooking->fresh('customer'), 'booking.cancelled');
                if ($refund?->status === 'processed') {
                    $this->notifyBookingLifecycle($rideBooking->fresh('customer'), 'refund.processed', ['refund_id' => $refund->id]);
                }

                return response()->json([
                    'message' => 'Ride booking cancelled successfully.',
                    'ride_booking' => $rideBooking->fresh(['driver:id,name,email,phone', 'refunds']),
                ]);
            }

            $updateData['status'] = $requestedStatus;
        }

        if (isset($validated['payment_status'])) {
            $updateData['payment_status'] = $validated['payment_status'];
        }

        $rideBooking->update($updateData);
        if (($updateData['status'] ?? null) === 'completed' && $rideBooking->fresh()->payment_status === 'paid') {
            app(CommissionService::class)->settleRide($rideBooking->fresh());
        }
        $this->recordBookingAudit($rideBooking->fresh(), 'status_updated', $before, $this->bookingAuditSnapshot($rideBooking->fresh()));
        $this->notifyStatusAndPaymentLifecycle($rideBooking->fresh('customer'), $updateData);

        return response()->json([
            'message' => 'Ride booking updated successfully.',
            'ride_booking' => $rideBooking->fresh(['driver:id,name,email,phone']),
        ]);
    }

    public function confirmRideBookingPayment(Request $request, RideBooking $rideBooking)
    {
        return $this->confirmBookingPayment($request, $rideBooking, 'ride_booking');
    }

    public function processBookingRefund(BookingRefund $bookingRefund)
    {
        $refund = app(BookingCancellationService::class)->processRefund($bookingRefund, Auth::id());
        if ($refund->status === 'processed' && $refund->refundable) {
            $this->notifyBookingLifecycle($refund->refundable->fresh('customer'), 'refund.processed', ['refund_id' => $refund->id]);
        }

        return response()->json([
            'message' => $refund->status === 'processed'
                ? 'Refund processed successfully.'
                : 'Refund could not be processed.',
            'refund' => $refund->fresh(['refundable', 'customer', 'walletTransaction']),
        ], $refund->status === 'processed' ? 200 : 422);
    }

    public function storeRideBookingIncident(Request $request, RideBooking $rideBooking)
    {
        return $this->storeBookingIncident($request, $rideBooking);
    }

    public function storeTourBookingIncident(Request $request, TourBooking $tourBooking)
    {
        return $this->storeBookingIncident($request, $tourBooking);
    }

    public function storeCarRentalIncident(Request $request, CarRental $carRental)
    {
        return $this->storeBookingIncident($request, $carRental);
    }

    public function updateBookingIncident(Request $request, BookingIncident $bookingIncident)
    {
        $validated = $request->validate([
            'status' => 'required|in:open,under_review,resolved,dismissed',
            'resolution' => 'nullable|string|max:2000',
        ]);

        $bookingIncident->update([
            'status' => $validated['status'],
            'resolution' => $validated['resolution'] ?? $bookingIncident->resolution,
            'resolved_at' => in_array($validated['status'], ['resolved', 'dismissed'], true) ? now() : null,
            'resolved_by' => in_array($validated['status'], ['resolved', 'dismissed'], true) ? Auth::id() : null,
        ]);

        return response()->json([
            'message' => 'Booking incident updated successfully.',
            'incident' => $bookingIncident->fresh(['incidentable', 'customer', 'driver']),
        ]);
    }

    private function storeBookingIncident(Request $request, \Illuminate\Database\Eloquent\Model $booking)
    {
        $validated = $request->validate([
            'type' => 'required|in:no_show,dispute,safety,payment,service_quality,other',
            'severity' => 'nullable|in:low,medium,high,critical',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:3000',
            'status' => 'nullable|in:open,under_review',
        ]);

        $incident = $booking->incidents()->create([
            'customer_id' => $booking->customer_id,
            'driver_id' => $booking->driver_id ?? $booking->assigned_driver_id ?? null,
            'opened_by_type' => Auth::user() ? get_class(Auth::user()) : null,
            'opened_by_id' => Auth::id(),
            'type' => $validated['type'],
            'severity' => $validated['severity'] ?? 'medium',
            'status' => $validated['status'] ?? 'open',
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'reported_at' => now(),
        ]);

        $this->recordBookingAudit($booking, 'incident_created', [], [
            'incident_id' => $incident->id,
            'type' => $incident->type,
            'severity' => $incident->severity,
            'status' => $incident->status,
        ], $incident->title);

        return response()->json([
            'message' => 'Booking incident recorded successfully.',
            'incident' => $incident->fresh(['incidentable', 'customer', 'driver']),
        ], 201);
    }

    private function recordBookingAudit(
        \Illuminate\Database\Eloquent\Model $booking,
        string $action,
        array $before = [],
        array $after = [],
        ?string $note = null
    ): BookingAuditLog {
        return $booking->auditLogs()->create([
            'admin_id' => Auth::id(),
            'action' => $action,
            'before' => $before,
            'after' => $after,
            'note' => $note,
        ]);
    }

    private function confirmBookingPayment(Request $request, \Illuminate\Database\Eloquent\Model $booking, string $type)
    {
        $validated = $request->validate([
            'payment_method' => 'required|in:cash,card,upi,bank_transfer,razorpay,wallet',
            'payment_reference' => 'required_if:payment_method,card,upi,bank_transfer|string|max:255|nullable',
            'note' => 'nullable|string|max:1000',
        ]);

        if ($booking->payment_status === 'refunded') {
            return response()->json([
                'message' => 'Refunded bookings cannot be marked as paid.',
            ], 422);
        }

        $before = $this->bookingAuditSnapshot($booking);

        DB::transaction(function () use ($booking, $validated, $before, $type) {
            $booking = $booking->newQuery()->lockForUpdate()->findOrFail($booking->id);
            abort_if($booking->status === 'cancelled' || $booking->payment_status === 'refunded', 422, 'Closed or refunded bookings cannot be confirmed.');
            if ($booking->payment_status === 'paid') {
                return;
            }
            app(\App\Services\PaymentService::class)->recordAdminReceipt(
                $booking, $validated['payment_method'], $validated['payment_reference'] ?? null, (int) Auth::id()
            );

            $this->recordBookingAudit(
                $booking->fresh(),
                'payment_confirmed',
                $before,
                array_merge($this->bookingAuditSnapshot($booking->fresh()), [
                    'payment_reference' => $validated['payment_reference'] ?? null,
                    'confirmation_type' => $type,
                ]),
                $validated['note'] ?? null
            );

        });

        return response()->json([
            'message' => 'Payment confirmed successfully.',
            'booking' => $booking->fresh(),
        ]);
    }

    private function bookingAuditSnapshot(\Illuminate\Database\Eloquent\Model $booking): array
    {
        return [
            'status' => $booking->status ?? null,
            'payment_status' => $booking->payment_status ?? null,
            'driver_id' => $booking->driver_id ?? $booking->assigned_driver_id ?? null,
            'vehicle_id' => $booking->vehicle_id ?? $booking->assigned_vehicle_id ?? null,
            'cancellation_reason' => $booking->cancellation_reason ?? null,
            'cancellation_fee' => $booking->cancellation_fee ?? null,
            'refund_amount' => $booking->refund_amount ?? null,
        ];
    }

    private function notifyStatusAndPaymentLifecycle(\Illuminate\Database\Eloquent\Model $booking, array $updates): void
    {
        if (isset($updates['status']) && ($action = $this->statusNotificationAction($updates['status']))) {
            $this->notifyBookingLifecycle($booking, $action);
        }

        if (isset($updates['payment_status']) && ($action = $this->paymentNotificationAction($updates['payment_status']))) {
            $this->notifyBookingLifecycle($booking, $action);
        }
    }

    private function notifyBookingLifecycle(\Illuminate\Database\Eloquent\Model $booking, string $action, array $metadata = []): void
    {
        app(BookingLifecycleNotifier::class)->emit($booking, $action, $metadata);
    }

    private function statusNotificationAction(string $status): ?string
    {
        return match ($status) {
            'driver_assigned' => 'driver.assigned',
            'in_progress', 'in_transit' => 'booking.started',
            'completed' => 'booking.completed',
            'cancelled' => 'booking.cancelled',
            default => null,
        };
    }

    private function paymentNotificationAction(string $paymentStatus): ?string
    {
        return match ($paymentStatus) {
            'paid' => 'payment.paid',
            'failed' => 'payment.failed',
            'refunded' => 'refund.processed',
            default => null,
        };
    }

    public function undoLastRideBookingChange(RideBooking $rideBooking)
    {
        if (! $this->canUndoLastChange($rideBooking)) {
            return response()->json([
                'message' => 'Undo window has expired or there is no change to undo.',
            ], 422);
        }

        $snapshot = $rideBooking->last_admin_change_snapshot ?? [];
        if (! is_array($snapshot) || empty($snapshot)) {
            return response()->json([
                'message' => 'No undo snapshot available.',
            ], 422);
        }

        $oldDriverId = $rideBooking->driver_id;
        $newDriverId = $snapshot['driver_id'] ?? null;

        if ($oldDriverId && $oldDriverId !== $newDriverId) {
            DriverAvailability::where('driver_id', $oldDriverId)->update(['is_available' => true]);
        }

        if ($newDriverId) {
            DriverAvailability::where('driver_id', $newDriverId)->update(['is_available' => false]);
        }

        $rideBooking->update([
            'driver_id' => $snapshot['driver_id'] ?? null,
            'status' => $snapshot['status'] ?? $rideBooking->status,
            'payment_status' => $snapshot['payment_status'] ?? $rideBooking->payment_status,
            'start_ride_pin' => $snapshot['start_ride_pin'] ?? null,
            'start_pin_verified_at' => $snapshot['start_pin_verified_at'] ?? null,
            'last_admin_change_snapshot' => null,
            'last_admin_changed_at' => null,
            'last_admin_changed_by' => null,
        ]);

        return response()->json([
            'message' => 'Last change undone successfully.',
            'ride_booking' => $rideBooking->fresh(['driver:id,name,email,phone']),
        ]);
    }

    private function captureAdminSnapshot(RideBooking $rideBooking): void
    {
        $rideBooking->last_admin_change_snapshot = [
            'driver_id' => $rideBooking->driver_id,
            'status' => $rideBooking->status,
            'payment_status' => $rideBooking->payment_status,
            'start_ride_pin' => $rideBooking->start_ride_pin,
            'start_pin_verified_at' => $rideBooking->start_pin_verified_at?->toDateTimeString(),
        ];
        $rideBooking->save();
    }

    private function canUndoLastChange(RideBooking $rideBooking): bool
    {
        if (! $rideBooking->last_admin_changed_at || empty($rideBooking->last_admin_change_snapshot)) {
            return false;
        }

        return $rideBooking->last_admin_changed_at->greaterThan(now()->subMinutes(10));
    }

    private function syncTourDurationFromItineraries(Tour $tour): void
    {
        $days = (int) $tour->itineraries()->max('day_number');
        $tour->update([
            'duration_days' => $days,
            'duration_nights' => max(0, $days - 1),
        ]);
    }

    private function normalizeTourItineraryStops(Tour $tour): void
    {
        $dayNumbers = $tour->itineraries()->select('day_number')->distinct()->orderBy('day_number')->pluck('day_number');

        $dayNumbers->values()->each(function (int $currentDay, int $dayIndex) use ($tour) {
            $normalizedDay = $dayIndex + 1;
            $stops = $tour->itineraries()
                ->where('day_number', $currentDay)
                ->orderBy('stop_order')
                ->orderBy('time')
                ->get();

            $stops->values()->each(function (TourItinerary $stop, int $stopIndex) use ($normalizedDay) {
                $stop->update([
                    'day_number' => $normalizedDay,
                    'day_index' => $normalizedDay,
                    'stop_order' => $stopIndex + 1,
                ]);
            });
        });
    }

    public function tourInquiries(Request $request)
    {
        $query = \App\Models\TourInquiry::with(['tour:id,title,slug', 'schedule:id,departure_date,departure_time', 'customer:id,name,phone,email']);

        if ($request->filled('inquiry_type')) {
            $query->where('inquiry_type', $request->inquiry_type);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('tour_id')) {
            $query->where('tour_id', $request->tour_id);
        }

        $inquiries = $query->latest()->paginate($request->input('per_page', 20));

        if ($request->wantsJson()) {
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

        return inertia('admin/TourInquiries', [
            'title' => 'Tour Inquiries & Waitlists',
            'inquiries' => $inquiries,
        ]);
    }

    public function updateTourInquiry(Request $request, \App\Models\TourInquiry $inquiry)
    {
        $validated = $request->validate([
            'status' => 'nullable|in:pending,contacted,fulfilled,cancelled',
            'operator_notes' => 'nullable|string|max:2000',
        ]);

        $inquiry->update(array_filter($validated, fn ($val) => $val !== null));

        return response()->json([
            'success' => true,
            'message' => 'Tour inquiry updated successfully.',
            'data' => $inquiry->fresh(['tour:id,title', 'schedule', 'customer']),
        ]);
    }

    public function notifyTourInquiry(Request $request, \App\Models\TourInquiry $inquiry)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:500',
        ]);

        $customer = $inquiry->customer;
        abort_unless($customer, 404, 'Customer not found.');

        $tourTitle = $inquiry->tour?->title ?? 'Tour';
        $content = [
            'sms' => 'Turiya Mobility: '.$validated['message'],
            'whatsapp' => "*Turiya Mobility Update*\n\n".$validated['message'],
            'email' => $validated['message'],
            'subject' => "Update regarding your inquiry for {$tourTitle}",
        ];

        $channels = ['sms'];
        if (! empty($customer->email)) {
            $channels[] = 'email';
        }

        app(\App\Services\NotificationService::class)->enqueue($customer, $channels, $content, [
            'dedup_key' => "tour:inquiry:manual_notify:{$inquiry->id}:".now()->timestamp,
        ]);

        $inquiry->update(['notified_at' => now(), 'status' => \App\Models\TourInquiry::STATUS_CONTACTED]);

        return response()->json([
            'success' => true,
            'message' => 'Notification dispatched to customer.',
            'data' => $inquiry->fresh(),
        ]);
    }

    public function carRentalChecklists(Request $request, CarRental $carRental)
    {
        return response()->json([
            'success' => true,
            'data' => $carRental->checklists,
        ]);
    }

    public function storeCarRentalChecklist(Request $request, CarRental $carRental)
    {
        $validated = $request->validate([
            'type' => 'required|in:handover,return',
            'odometer_reading' => 'nullable|numeric',
            'fuel_level_percent' => 'nullable|integer|min:0|max:100',
            'cleanliness' => 'nullable|in:clean,moderate,dirty',
            'checklist_items' => 'nullable|array',
            'photos' => 'nullable|array',
            'damage_detected' => 'nullable|boolean',
            'damage_notes' => 'nullable|string',
            'customer_acknowledged' => 'nullable|boolean',
        ]);

        $checklist = app(\App\Services\RentalChecklistService::class)->submitChecklist(
            $carRental,
            $validated['type'],
            $validated,
            'admin',
            $request->user()->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Checklist saved successfully.',
            'data' => $checklist,
        ]);
    }

    public function previewCarRentalAmendment(Request $request, CarRental $carRental)
    {
        $validated = $request->validate([
            'end_date' => 'required|date|after_or_equal:'.$carRental->start_date->format('Y-m-d'),
            'end_time' => 'nullable|date_format:H:i:s',
        ]);

        $preview = app(\App\Services\CarRentalAmendmentService::class)->preview($carRental, $validated);

        return response()->json([
            'success' => true,
            'data' => $preview,
        ]);
    }

    public function amendCarRental(Request $request, CarRental $carRental)
    {
        $validated = $request->validate([
            'version' => 'nullable|string|size:64',
            'end_date' => 'required|date|after_or_equal:'.$carRental->start_date->format('Y-m-d'),
            'end_time' => 'nullable|date_format:H:i:s',
        ]);

        try {
            $requestId = $request->header('Idempotency-Key') ?? uniqid('amend_', true);
            $amended = app(\App\Services\CarRentalAmendmentService::class)->amend($carRental, $validated, $request->user()->id, $requestId);

            return response()->json([
                'success' => true,
                'message' => 'Rental amended successfully.',
                'data' => $amended,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    public function reviewNoShow(Request $request, \App\Models\TourBooking $booking)
    {
        $validated = $request->validate([
            'decision' => 'required|in:confirmed,excused',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            app(\App\Services\TourAttendanceService::class)->reviewNoShow(
                $booking,
                $validated['decision'],
                $validated['notes'] ?? null
            );

            return response()->json([
                'success' => true,
                'message' => 'No-show reviewed successfully.',
                'data' => $booking->fresh(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }
}

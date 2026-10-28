<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AdminCustomerController extends Controller
{
    /**
     * List all customers with pagination and search.
     */
    public function index(Request $request)
    {
        $query = Customer::query();

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

        $customers = $query->withCount(['rideBookings', 'carRentals', 'bookings'])
            ->latest()
            ->paginate(15);

        return inertia('admin/Customers', [
            'title' => 'Customer Management',
            'user' => Auth::user(),
            'customers' => $customers,
            'filters' => $request->only(['search', 'status']),
        ]);
    }

    /**
     * Show customer details.
     */
    public function show(Customer $customer)
    {
        $customer->load([
            'rideBookings' => fn ($q) => $q->latest()->take(10),
            'carRentals' => fn ($q) => $q->latest()->take(10),
            'bookings' => fn ($q) => $q->latest()->take(10),
            'wallet',
        ]);

        $stats = [
            'total_rides' => $customer->rideBookings()->count(),
            'total_rentals' => $customer->carRentals()->count(),
            'total_tours' => $customer->bookings()->count(),
            'total_spent' => $customer->rideBookings()->sum('total_fare')
                + $customer->carRentals()->sum('total_price'),
            'wallet_balance' => $customer->wallet?->balance ?? 0,
        ];

        return inertia('admin/Customers/Show', [
            'title' => 'Customer Details',
            'user' => Auth::user(),
            'customer' => $customer,
            'stats' => $stats,
        ]);
    }

    /**
     * Toggle customer active/suspended status.
     */
    public function toggleStatus(Customer $customer)
    {
        $newStatus = $customer->status === 'suspended' ? 'active' : 'suspended';
        $customer->update(['status' => $newStatus]);

        if ($newStatus === 'suspended') {
            $customer->tokens()->delete();
        }

        if (request()->expectsJson() || request()->is('api/*')) {
            return response()->json([
                'message' => "Customer {$customer->name} has been ".($newStatus === 'suspended' ? 'suspended' : 'activated').'.',
                'customer' => $customer->fresh(),
            ]);
        }

        return redirect()->back()->with('success',
            "Customer {$customer->name} has been ".($newStatus === 'suspended' ? 'suspended' : 'activated').'.'
        );
    }

    /**
     * Show edit customer form.
     */
    public function edit(Customer $customer)
    {
        return inertia('admin/Customers/Edit', [
            'title' => 'Edit Customer',
            'user' => Auth::user(),
            'customer' => $customer,
        ]);
    }

    /**
     * Update customer details.
     */
    public function update(Request $request, Customer $customer)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|unique:customers,email,'.$customer->id,
            'phone' => 'required|string|unique:customers,phone,'.$customer->id,
            'status' => 'required|in:active,suspended',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'emergency_contact_name' => 'nullable|string|max:255',
            'emergency_contact_phone' => 'nullable|string|max:255',
        ]);

        $customer->update([
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'status' => $request->status,
            'date_of_birth' => $request->date_of_birth,
            'gender' => $request->gender,
            'emergency_contact_name' => $request->emergency_contact_name,
            'emergency_contact_phone' => $request->emergency_contact_phone,
        ]);

        return redirect()->route('admin.customers.show', $customer->id)->with('success', 'Customer details updated successfully.');
    }
}

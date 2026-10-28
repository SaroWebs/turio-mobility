<?php

namespace App\Policies;

use App\Models\TourBooking;
use Illuminate\Foundation\Auth\User as Authenticatable;

class TourBookingPolicy
{
    public function view(Authenticatable $user, TourBooking $booking): bool
    {
        return $this->isCustomer($user, $booking)
            || $this->isAssignedDriver($user, $booking)
            || $this->isAdmin($user);
    }

    public function track(Authenticatable $user, TourBooking $booking): bool
    {
        return $this->view($user, $booking);
    }

    public function updateLocation(Authenticatable $user, TourBooking $booking): bool
    {
        return $this->isAssignedDriver($user, $booking)
            && ! in_array($booking->status, ['completed', 'cancelled'], true)
            && $booking->driverAssignments()->where('driver_id', $user->id)->where('status', 'accepted')->exists();
    }

    public function review(Authenticatable $user, TourBooking $booking): bool
    {
        return $this->isCustomer($user, $booking);
    }

    public function administer(Authenticatable $user, TourBooking $booking): bool
    {
        return $this->isAdmin($user);
    }

    private function isCustomer(Authenticatable $user, TourBooking $booking): bool
    {
        return method_exists($user, 'isCustomer')
            && $user->isCustomer()
            && (int) $booking->customer_id === (int) $user->id;
    }

    private function isAssignedDriver(Authenticatable $user, TourBooking $booking): bool
    {
        return method_exists($user, 'isDriver')
            && $user->isDriver()
            && $booking->driverAssignments()->where('driver_id', $user->id)->exists();
    }

    private function isAdmin(Authenticatable $user): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }
}

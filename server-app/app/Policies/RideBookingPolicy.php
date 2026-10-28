<?php

namespace App\Policies;

use App\Models\RideBooking;
use Illuminate\Foundation\Auth\User as Authenticatable;

class RideBookingPolicy
{
    public function view(Authenticatable $user, RideBooking $booking): bool
    {
        return $this->isCustomer($user, $booking)
            || $this->isDriver($user, $booking)
            || $this->isAdmin($user);
    }

    public function track(Authenticatable $user, RideBooking $booking): bool
    {
        return $this->view($user, $booking);
    }

    public function updateLocation(Authenticatable $user, RideBooking $booking): bool
    {
        return $this->isDriver($user, $booking);
    }

    public function updateStatus(Authenticatable $user, RideBooking $booking): bool
    {
        return $this->view($user, $booking);
    }

    public function review(Authenticatable $user, RideBooking $booking): bool
    {
        return $this->isCustomer($user, $booking);
    }

    public function tip(Authenticatable $user, RideBooking $booking): bool
    {
        return $this->isCustomer($user, $booking);
    }

    public function administer(Authenticatable $user, RideBooking $booking): bool
    {
        return $this->isAdmin($user);
    }

    private function isCustomer(Authenticatable $user, RideBooking $booking): bool
    {
        return method_exists($user, 'isCustomer')
            && $user->isCustomer()
            && (int) $booking->customer_id === (int) $user->id;
    }

    private function isDriver(Authenticatable $user, RideBooking $booking): bool
    {
        return method_exists($user, 'isDriver')
            && $user->isDriver()
            && (int) $booking->driver_id === (int) $user->id;
    }

    private function isAdmin(Authenticatable $user): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }
}

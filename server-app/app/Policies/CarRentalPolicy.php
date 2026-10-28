<?php

namespace App\Policies;

use App\Models\CarRental;
use Illuminate\Foundation\Auth\User as Authenticatable;

class CarRentalPolicy
{
    public function view(Authenticatable $user, CarRental $rental): bool
    {
        return $this->isCustomer($user, $rental)
            || $this->isDriver($user, $rental)
            || $this->isAdmin($user);
    }

    public function track(Authenticatable $user, CarRental $rental): bool
    {
        return $this->view($user, $rental);
    }

    public function updateLocation(Authenticatable $user, CarRental $rental): bool
    {
        return $this->isDriver($user, $rental);
    }

    public function updateAssignment(Authenticatable $user, CarRental $rental): bool
    {
        return $this->isDriver($user, $rental);
    }

    public function review(Authenticatable $user, CarRental $rental): bool
    {
        return $this->isCustomer($user, $rental);
    }

    public function administer(Authenticatable $user, CarRental $rental): bool
    {
        return $this->isAdmin($user);
    }

    private function isCustomer(Authenticatable $user, CarRental $rental): bool
    {
        return method_exists($user, 'isCustomer')
            && $user->isCustomer()
            && (int) $rental->customer_id === (int) $user->id;
    }

    private function isDriver(Authenticatable $user, CarRental $rental): bool
    {
        return method_exists($user, 'isDriver')
            && $user->isDriver()
            && (int) $rental->driver_id === (int) $user->id;
    }

    private function isAdmin(Authenticatable $user): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }
}

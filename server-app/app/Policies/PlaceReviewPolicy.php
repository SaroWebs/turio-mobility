<?php

namespace App\Policies;

use App\Models\Place;
use App\Models\PlaceReview;
use Illuminate\Foundation\Auth\User as Authenticatable;

class PlaceReviewPolicy
{
    public function viewAny(Authenticatable $user): bool
    {
        return true;
    }

    public function create(Authenticatable $user, Place $place): bool
    {
        return method_exists($user, 'isCustomer') && $user->isCustomer();
    }

    public function update(Authenticatable $user, PlaceReview $review): bool
    {
        return method_exists($user, 'isCustomer')
            && $user->isCustomer()
            && (int) $review->customer_id === (int) $user->id;
    }

    public function delete(Authenticatable $user, PlaceReview $review): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }
}

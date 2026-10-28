<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Driver extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $table = 'drivers';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'profile_photo',
        'date_of_birth',
        'gender',
        'license_number',
        'license_expiry',
        'vehicle_type',
        'vehicle_number',
        'vehicle_model',
        'vehicle_color',
        'vehicle_year',
        'status',
        'is_online',
        'is_active',
        'is_approved',
        'approved_at',
        'approved_by',
        'rating',
        'total_rides',
        'total_tours',
        'can_short_ride',
        'can_long_ride',
        'can_tour_lead',
        'can_tour_transport',
        'can_rental_delivery',
        'languages',
        'expertise_tags',
        'certification_notes',
        'bank_account_number',
        'bank_account_name',
        'bank_name',
        'ifsc_code',
        'funding_eligible',
        'funding_activated_at',
        'phone_verified_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'bank_account_number',
        'ifsc_code',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'license_expiry' => 'date',
            'date_of_birth' => 'date',
            'approved_at' => 'datetime',
            'is_online' => 'boolean',
            'is_active' => 'boolean',
            'is_approved' => 'boolean',
            'rating' => 'decimal:2',
            'can_short_ride' => 'boolean',
            'can_long_ride' => 'boolean',
            'can_tour_lead' => 'boolean',
            'can_tour_transport' => 'boolean',
            'can_rental_delivery' => 'boolean',
            'languages' => 'array',
            'expertise_tags' => 'array',
            'funding_eligible' => 'boolean',
            'funding_activated_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function vehicle(): HasOne
    {
        return $this->hasOne(Vehicle::class, 'driver_id');
    }

    public function driverAvailability(): HasOne
    {
        return $this->hasOne(DriverAvailability::class, 'driver_id');
    }

    public function locations(): HasMany
    {
        return $this->hasMany(DriverLocation::class, 'driver_id');
    }

    public function latestLocation(): HasOne
    {
        return $this->hasOne(DriverLocation::class, 'driver_id')->latestOfMany('id');
    }

    public function rideBookings(): HasMany
    {
        return $this->hasMany(RideBooking::class, 'driver_id');
    }

    public function rideDispatchAttempts(): HasMany
    {
        return $this->hasMany(RideDispatchAttempt::class, 'driver_id');
    }

    public function assignedRideBookings(): HasMany
    {
        return $this->hasMany(RideBooking::class, 'driver_id');
    }

    public function carRentals(): HasMany
    {
        return $this->hasMany(CarRental::class, 'driver_id');
    }

    public function tourDriverAssignments(): HasMany
    {
        return $this->hasMany(TourDriverAssignment::class, 'driver_id');
    }

    public function wallet(): MorphOne
    {
        return $this->morphOne(Wallet::class, 'owner');
    }

    public function withdrawalRequests(): MorphMany
    {
        return $this->morphMany(WithdrawalRequest::class, 'owner');
    }

    public function rideReviews(): HasMany
    {
        return $this->hasMany(RideBookingReview::class, 'driver_id');
    }

    public function rentalReviews(): HasMany
    {
        return $this->hasMany(CarRentalReview::class, 'driver_id');
    }

    public function tourReviews(): HasMany
    {
        return $this->hasMany(TourBookingReview::class, 'driver_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(DriverDocument::class);
    }

    // ── Helpers ────────────────────────────────────────────────────

    public function getWalletBalanceMinor(): int
    {
        return $this->wallet()->first()?->getBalanceMinor() ?? 0;
    }

    public function isFundingEligible(): bool
    {
        return app(\App\Services\DriverFundingPolicy::class)->eligible($this);
    }

    public function isOnline(): bool
    {
        return (bool) $this->is_online;
    }

    public function isApproved(): bool
    {
        return (bool) $this->is_approved;
    }

    public function isAdmin(): bool
    {
        return false;
    }

    public function isDriver(): bool
    {
        return true;
    }

    public function isCustomer(): bool
    {
        return false;
    }

    public function isGuide(): bool
    {
        return false;
    }

    public function canHandleService(string $serviceType, ?string $role = null): bool
    {
        return match ($serviceType) {
            'short_ride' => (bool) $this->can_short_ride,
            'long_ride' => (bool) $this->can_long_ride,
            'tour' => $role === 'lead'
                ? (bool) $this->can_tour_lead
                : ((bool) $this->can_tour_transport || (bool) $this->can_tour_lead),
            'rental' => (bool) $this->can_rental_delivery,
            default => false,
        };
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Guide extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'guides';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'profile_photo',
        'date_of_birth',
        'gender',
        'bio',
        'languages',
        'specializations',
        'experience_years',
        'certification_number',
        'certification_expiry',
        'status',
        'is_active',
        'is_approved',
        'approved_at',
        'approved_by',
        'rating',
        'total_tours',
        'bank_account_number',
        'bank_account_name',
        'bank_name',
        'ifsc_code',
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
            'date_of_birth' => 'date',
            'certification_expiry' => 'date',
            'approved_at' => 'datetime',
            'languages' => 'array',
            'specializations' => 'array',
            'is_active' => 'boolean',
            'is_approved' => 'boolean',
            'rating' => 'decimal:2',
            'password' => 'hashed',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function tourGuideAssignments(): HasMany
    {
        return $this->hasMany(TourGuideAssignment::class, 'guide_id');
    }

    public function tourBookingAssignments(): HasMany
    {
        return $this->hasMany(TourBooking::class, 'assigned_guide_id');
    }

    public function withdrawalRequests(): MorphMany
    {
        return $this->morphMany(WithdrawalRequest::class, 'owner');
    }

    // ── Helpers ────────────────────────────────────────────────────

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
        return false;
    }

    public function isCustomer(): bool
    {
        return false;
    }

    public function isGuide(): bool
    {
        return true;
    }
}

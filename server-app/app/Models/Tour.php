<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tour extends Model
{
    protected $hidden = ['brochure_path'];

    protected $fillable = [
        'tour_category_id',
        'title',
        'slug',
        'description',
        'short_description',
        'highlights',
        'inclusions',
        'exclusions',
        'cancellation_policy',
        'faqs',
        'duration_days',
        'duration_nights',
        'min_group_size',
        'max_group_size',
        'price_per_person',
        'child_price',
        'discount',
        'start_location',
        'end_location',
        'region',
        'difficulty',
        'cover_image',
        'gallery',
        'available_from',
        'available_to',
        'is_active',
        'is_featured',
    ];

    protected $casts = [
        'brochure_uploaded_at' => 'datetime',
        'available_from' => 'date',
        'available_to' => 'date',
        'highlights' => 'array',
        'inclusions' => 'array',
        'exclusions' => 'array',
        'faqs' => 'array',
        'gallery' => 'array',
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'price_per_person' => 'decimal:2',
        'child_price' => 'decimal:2',
        'discount' => 'decimal:2',
    ];

    // ── Relationships ──────────────────────────────────────────────

    public function category(): BelongsTo
    {
        return $this->belongsTo(TourCategory::class, 'tour_category_id');
    }

    public function itineraries(): HasMany
    {
        return $this->hasMany(TourItinerary::class, 'tour_id')
            ->orderBy('day_number')
            ->orderBy('stop_order')
            ->orderBy('time');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(TourSchedule::class, 'tour_id')->orderBy('departure_date');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(TourBooking::class, 'tour_id');
    }

    public function drivers(): BelongsToMany
    {
        return $this->belongsToMany(Driver::class, 'tour_driver_assignments', 'tour_schedule_id', 'driver_id')
            ->join('tour_schedules', 'tour_driver_assignments.tour_schedule_id', '=', 'tour_schedules.id')
            ->where('tour_schedules.tour_id', $this->getKey())
            ->using(TourDriverAssignment::class)
            ->withPivot('vehicle_id', 'status', 'fee', 'notes')
            ->withTimestamps();
    }

    public function guides(): BelongsToMany
    {
        return $this->belongsToMany(Guide::class, 'tour_guide_assignments', 'tour_schedule_id', 'guide_id')
            ->join('tour_schedules', 'tour_guide_assignments.tour_schedule_id', '=', 'tour_schedules.id')
            ->where('tour_schedules.tour_id', $this->getKey())
            ->using(TourGuideAssignment::class)
            ->withPivot('role', 'status', 'fee', 'notes')
            ->withTimestamps();
    }

    public function wishlistItems()
    {
        return $this->hasMany(Wishlist::class, 'service_id', 'id')->where('service_type', 'tour');
    }

    public function isInWishlistFor(int $customerId): bool
    {
        return $this->wishlistItems()->where('customer_id', $customerId)->exists();
    }

    // ── Helpers ────────────────────────────────────────────────────

    public function getDiscountedPrice(): float
    {
        return $this->price_per_person * (1 - $this->discount / 100);
    }

    public function getDurationLabelAttribute(): string
    {
        $d = $this->duration_days.'D';
        $n = $this->duration_nights.'N';

        return "{$d}/{$n}";
    }

    public function getNextAvailableSchedule(int $guests = 1): ?TourSchedule
    {
        return $this->schedules()
            ->bookable($guests)
            ->orderByRaw('COALESCE(departure_at, departure_date) ASC')
            ->orderBy('id', 'ASC')
            ->first();
    }

    /**
     * Check if the tour meets customer availability and group size constraints.
     */
    public function isAvailableForGuests(int $guests = 1): bool
    {
        return $this->exists && static::query()->whereKey($this->getKey())->bookableForGuests($guests)->exists();
    }

    /**
     * Scope a query to only include active tours.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to include tours bookable for a given guest count.
     */
    public function scopeBookableForGuests($query, int $guests = 1)
    {
        $localDate = now()->timezone(config('app.business_timezone', 'Asia/Kolkata'))->toDateString();
        $query->active()
            ->where(fn ($q) => $q->whereNull('available_from')->orWhereDate('available_from', '<=', $localDate))
            ->where(fn ($q) => $q->whereNull('available_to')->orWhereDate('available_to', '>=', $localDate));

        if (setting('tour.enforce_group_size', false)) {
            $query->where(fn ($q) => $q->whereNull('min_group_size')->orWhere('min_group_size', '<=', $guests))
                ->where(fn ($q) => $q->whereNull('max_group_size')->orWhere('max_group_size', '>=', $guests));
        }

        return $query;
    }
}

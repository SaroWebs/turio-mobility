<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Place extends Model
{
    protected $table = 'places';

    protected $fillable = [
        'place_category_id',
        'name',
        'slug',
        'description',
        'short_description',
        'location',
        'city',
        'state',
        'country',
        'latitude',
        'longitude',
        'rating',
        'review_count',
        'cover_image',
        'tags',
        'google_place_id',
        'google_rating',
        'google_review_count',
        'google_reviews',
        'google_photos',
        'google_details',
        'google_synced_at',
        'is_active',
        'is_featured',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'rating' => 'decimal:2',
        'review_count' => 'integer',
        'tags' => 'array',
        'google_rating' => 'decimal:2',
        'google_review_count' => 'integer',
        'google_reviews' => 'array',
        'google_photos' => 'array',
        'google_details' => 'array',
        'google_synced_at' => 'datetime',
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(PlaceCategory::class, 'place_category_id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(PlaceMedia::class, 'place_id')->orderBy('sort_order');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(PlaceReview::class, 'place_id')->latest();
    }
}

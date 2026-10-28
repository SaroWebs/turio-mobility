<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Destination extends Model
{
    protected $table = 'destinations';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'short_description',
        'country',
        'state',
        'city',
        'latitude',
        'longitude',
        'cover_image',
        'gallery',
        'highlights',
        'rating',
        'is_active',
        'is_featured',
        'sort_order',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'gallery' => 'array',
        'highlights' => 'array',
        'rating' => 'decimal:2',
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Scope a query to only include active destinations.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}

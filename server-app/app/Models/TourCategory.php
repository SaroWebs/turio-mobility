<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TourCategory extends Model
{
    protected $table = 'tour_categories';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'cover_image',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function tours(): HasMany
    {
        return $this->hasMany(Tour::class, 'tour_category_id');
    }

    public function activeTours(): HasMany
    {
        return $this->hasMany(Tour::class, 'tour_category_id')->where('is_active', true);
    }
}

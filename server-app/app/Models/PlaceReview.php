<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlaceReview extends Model
{
    protected $fillable = [
        'place_id',
        'customer_id',
        'rating',
        'review',
    ];

    public function place(): BelongsTo
    {
        return $this->belongsTo(Place::class, 'place_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}

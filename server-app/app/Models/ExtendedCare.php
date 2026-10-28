<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ExtendedCare extends Model
{
    protected $table = 'extended_care';

    protected $fillable = [
        'customer_id',
        'serviceable_type',
        'serviceable_id',
        'care_type',
        'description',
        'status',
        'cost',
        'notes',
        'resolved_at',
    ];

    protected $casts = [
        'cost' => 'decimal:2',
        'resolved_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /** The service context: RideBooking or CarRental */
    public function serviceable(): MorphTo
    {
        return $this->morphTo();
    }
}

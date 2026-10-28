<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class BookingIncident extends Model
{
    protected $fillable = [
        'incidentable_type',
        'incidentable_id',
        'customer_id',
        'driver_id',
        'opened_by_type',
        'opened_by_id',
        'type',
        'severity',
        'status',
        'title',
        'description',
        'resolution',
        'reported_at',
        'resolved_at',
        'resolved_by',
    ];

    protected $casts = [
        'reported_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function incidentable(): MorphTo
    {
        return $this->morphTo();
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }
}

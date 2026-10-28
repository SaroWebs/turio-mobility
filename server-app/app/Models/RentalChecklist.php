<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class RentalChecklist extends Model
{
    protected $table = 'rental_checklists';

    protected $fillable = [
        'car_rental_id',
        'type',
        'completed_by_type',
        'completed_by_id',
        'odometer_reading',
        'fuel_level_percent',
        'cleanliness',
        'checklist_items',
        'photos',
        'damage_detected',
        'damage_notes',
        'customer_acknowledged',
    ];

    protected $casts = [
        'checklist_items' => 'array',
        'photos' => 'array',
        'damage_detected' => 'boolean',
        'customer_acknowledged' => 'boolean',
        'odometer_reading' => 'decimal:2',
    ];

    public function carRental(): BelongsTo
    {
        return $this->belongsTo(CarRental::class, 'car_rental_id');
    }
    
    public function completedBy(): MorphTo
    {
        return $this->morphTo('completed_by');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverInsurancePolicy extends Model
{
    protected $fillable = ['driver_id', 'vehicle_id', 'policy_number', 'product_code', 'provider_name', 'coverage_amount', 'premium', 'start_date', 'end_date', 'status', 'terms_version', 'verified_at', 'verified_by'];

    protected $casts = ['coverage_amount' => 'decimal:2', 'premium' => 'decimal:2', 'start_date' => 'date', 'end_date' => 'date', 'verified_at' => 'datetime'];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'active' && ! $this->start_date->isFuture() && ! $this->end_date->isPast() && $this->verified_at !== null;
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Str;

class InsurancePolicy extends Model
{
    protected $table = 'insurance_policies';

    protected $fillable = [
        'policy_number',
        'customer_id',
        'coverable_type',
        'coverable_id',
        'policy_type',
        'product_code',
        'provider_name',
        'premium',
        'coverage_amount',
        'start_date',
        'end_date',
        'status',
        'terms',
        'terms_version',
        'terms_accepted_at',
        'issued_at',
        'cancelled_at',
    ];

    protected $casts = [
        'premium' => 'decimal:2',
        'coverage_amount' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
        'terms_accepted_at' => 'datetime',
        'issued_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /** The insured entity: RideBooking or CarRental */
    public function coverable(): MorphTo
    {
        return $this->morphTo();
    }

    public function claims(): HasMany
    {
        return $this->hasMany(InsuranceClaim::class, 'insurance_policy_id');
    }

    public static function generatePolicyNumber(): string
    {
        do {
            $number = 'POL'.date('Ymd').strtoupper(Str::random(4));
        } while (static::where('policy_number', $number)->exists());

        return $number;
    }

    public function isActive(): bool
    {
        return $this->status === 'active'
            && ! $this->start_date->isFuture()
            && ! $this->end_date->isPast();
    }

    public function isExpired(): bool
    {
        return $this->status === 'expired' || $this->end_date->isPast();
    }
}

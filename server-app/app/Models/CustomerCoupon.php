<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerCoupon extends Model
{
    protected $fillable = [
        'code',
        'name',
        'description',
        'discount_type',
        'discount_value',
        'max_discount_amount',
        'min_order_amount',
        'service_types',
        'usage_limit',
        'per_customer_limit',
        'used_count',
        'starts_at',
        'ends_at',
        'is_active',
        'is_deal',
        'deal_tag',
        'metadata',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'max_discount_amount' => 'decimal:2',
        'min_order_amount' => 'decimal:2',
        'service_types' => 'array',
        'metadata' => 'array',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_active' => 'boolean',
        'is_deal' => 'boolean',
    ];

    public function redemptions(): HasMany
    {
        return $this->hasMany(CustomerCouponRedemption::class);
    }

    public function scopeCode($query, string $code)
    {
        return $query->where('code', strtoupper(trim($code)));
    }
}

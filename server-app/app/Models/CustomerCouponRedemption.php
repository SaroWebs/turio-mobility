<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class CustomerCouponRedemption extends Model
{
    protected $fillable = [
        'customer_coupon_id',
        'customer_id',
        'service_type',
        'redeemable_type',
        'redeemable_id',
        'subtotal_amount',
        'discount_amount',
        'final_amount',
        'redeemed_at',
    ];

    protected $casts = [
        'subtotal_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'final_amount' => 'decimal:2',
        'redeemed_at' => 'datetime',
    ];

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(CustomerCoupon::class, 'customer_coupon_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function redeemable(): MorphTo
    {
        return $this->morphTo();
    }
}

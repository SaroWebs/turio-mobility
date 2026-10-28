<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerReferral extends Model
{
    use HasFactory;

    protected $table = 'customer_referrals';

    protected $fillable = [
        'referrer_customer_id',
        'referred_customer_id',
        'referral_code',
        'status',
        'reward_points',
        'completed_at',
    ];

    protected $casts = [
        'reward_points' => 'integer',
        'completed_at' => 'datetime',
    ];

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'referrer_customer_id');
    }

    public function referred(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'referred_customer_id');
    }
}

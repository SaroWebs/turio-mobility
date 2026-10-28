<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerLoyaltyPoint extends Model
{
    use HasFactory;

    protected $table = 'customer_loyalty_points';

    protected $fillable = [
        'customer_id',
        'points',
        'action',
        'reference_type',
        'reference_id',
        'description',
    ];

    protected $casts = [
        'points' => 'integer',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}

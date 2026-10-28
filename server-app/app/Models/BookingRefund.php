<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class BookingRefund extends Model
{
    protected $fillable = [
        'refundable_type',
        'refundable_id',
        'customer_id',
        'wallet_transaction_id',
        'amount',
        'cancellation_fee',
        'method',
        'status',
        'reason',
        'processed_at',
        'processed_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'cancellation_fee' => 'decimal:2',
        'processed_at' => 'datetime',
    ];

    public function refundable(): MorphTo
    {
        return $this->morphTo();
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function walletTransaction(): BelongsTo
    {
        return $this->belongsTo(WalletTransaction::class);
    }
}

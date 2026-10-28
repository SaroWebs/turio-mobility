<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class WithdrawalRequest extends Model
{
    protected $table = 'withdrawal_requests';

    protected $fillable = [
        'owner_type',
        'owner_id',
        'amount',
        'method',
        'account_details',
        'status',
        'rejection_reason',
        'admin_notes',
        'utr_number',
        'razorpay_fund_account_id',
        'razorpay_payout_id',
        'processed_at',
        'processed_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'account_details' => 'array',
        'processed_at' => 'datetime',
    ];

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * The payout that carries this withdrawal out to the provider. Latest wins
     * so a retried approval (which creates a fresh payout only if none is live)
     * still resolves to the current attempt.
     */
    public function payout(): HasOne
    {
        return $this->hasOne(Payout::class)->latestOfMany();
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isProcessing(): bool
    {
        return $this->status === 'processing';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    public function reject(int $adminId, string $rejectionReason, ?string $adminNotes = null): bool
    {
        return $this->update([
            'status' => 'rejected',
            'processed_by' => $adminId,
            'processed_at' => now(),
            'rejection_reason' => $rejectionReason,
            'admin_notes' => $adminNotes,
        ]);
    }

    public function markAsProcessing(): bool
    {
        return $this->update([
            'status' => 'processing',
        ]);
    }

    public function markAsCompleted(string $utrNumber): bool
    {
        return $this->update([
            'status' => 'completed',
            'utr_number' => $utrNumber,
            'processed_at' => now(),
        ]);
    }

    public function markAsFailed(string $error): bool
    {
        return $this->update([
            'status' => 'rejected',
            'admin_notes' => 'Payout failed: '.$error,
            'processed_at' => now(),
        ]);
    }

    public function scopeForOwner($query, $user)
    {
        return $query->where('owner_type', get_class($user))
            ->where('owner_id', $user->id);
    }
}

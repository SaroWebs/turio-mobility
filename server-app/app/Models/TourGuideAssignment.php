<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TourGuideAssignment extends Model
{
    protected $table = 'tour_guide_assignments';

    protected $fillable = [
        'tour_schedule_id',
        'guide_id',
        'role',
        'status',
        'fee',
        'notes',
    ];

    protected $casts = [
        'fee' => 'decimal:2',
    ];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(TourSchedule::class, 'tour_schedule_id');
    }

    public function guide(): BelongsTo
    {
        return $this->belongsTo(Guide::class, 'guide_id');
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    public function isDeclined(): bool
    {
        return $this->status === 'declined';
    }

    public function isPending(): bool
    {
        return $this->status === 'assigned';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }
}

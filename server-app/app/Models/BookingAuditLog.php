<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class BookingAuditLog extends Model
{
    protected $fillable = [
        'auditable_type',
        'auditable_id',
        'admin_id',
        'action',
        'before',
        'after',
        'note',
    ];

    protected $casts = [
        'before' => 'array',
        'after' => 'array',
    ];

    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}

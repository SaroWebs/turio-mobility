<?php

namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlaceMedia extends Model
{
    protected $table = 'place_media';

    protected $appends = [
        'file_path',
        'file_type',
        'url',
    ];

    protected $fillable = [
        'place_id',
        'uploaded_by_customer_id',
        'path',
        'type',
        'source',
        'approval_status',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
        'caption',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'reviewed_at' => 'datetime',
    ];

    public function place(): BelongsTo
    {
        return $this->belongsTo(Place::class, 'place_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'uploaded_by_customer_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function scopeApproved($query)
    {
        return $query->where('approval_status', 'approved');
    }

    public function getFilePathAttribute(): string
    {
        return $this->path;
    }

    public function getFileTypeAttribute(): string
    {
        return $this->type;
    }

    public function getUrlAttribute(): string
    {
        return MediaUrl::resolve($this->path) ?? '';
    }

    public function isImage(): bool
    {
        return $this->type === 'image';
    }

    public function isPanorama(): bool
    {
        return $this->type === 'panorama';
    }

    public function isVideo(): bool
    {
        return $this->type === 'video';
    }
}

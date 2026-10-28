<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverDocument extends Model
{
    protected $fillable = [
        'driver_id',
        'type',
        'document_number',
        'file_path',
        'expires_at',
        'status',
        'rejection_reason',
        'reviewed_at',
        'reviewed_by',
        'encrypted_number', 'storage_disk', 'version', 'extra_attempts', 'verification_outcome', 'checksum',
        'requires_second_review', 'approved_subject_hash', 'evidence_subject_hash',
    ];

    protected $casts = [
        'expires_at' => 'date',
        'reviewed_at' => 'datetime',
        'encrypted_number' => 'encrypted',
        'version' => 'integer',
        'extra_attempts' => 'integer',
        'requires_second_review' => 'boolean',
    ];

    protected $hidden = ['file_path', 'document_number', 'encrypted_number', 'checksum', 'storage_disk'];

    protected $appends = ['file_url', 'masked_number'];

    public function versions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(DriverDocumentVersion::class)->orderByDesc('version');
    }

    public function getMaskedNumberAttribute(): ?string
    {
        $number = $this->encrypted_number ?: $this->document_number;

        return $number ? '****'.substr($number, -4) : null;
    }

    public function verificationAttempts(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(DocumentVerificationAttempt::class)->orderByDesc('id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function getFileUrlAttribute(): ?string
    {
        // URLs must be issued by an authorized, authenticated preview endpoint.
        return null;
    }
}

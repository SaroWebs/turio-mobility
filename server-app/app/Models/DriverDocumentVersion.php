<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DriverDocumentVersion extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected $hidden = ['file_path', 'encrypted_number', 'checksum', 'storage_disk'];

    protected $casts = ['encrypted_number' => 'encrypted', 'expires_at' => 'date'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Document versions are immutable.'));
        static::deleting(fn () => throw new \LogicException('Document versions require the retention process.'));
    }
}

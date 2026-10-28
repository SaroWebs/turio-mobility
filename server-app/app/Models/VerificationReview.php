<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VerificationReview extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected $casts = ['evidence' => 'encrypted:array'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Review history is immutable.'));
        static::deleting(fn () => throw new \LogicException('Review history requires the retention process.'));
    }
}

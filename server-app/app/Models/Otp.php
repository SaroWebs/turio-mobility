<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Otp extends Model
{
    protected $table = 'otps';

    protected $fillable = [
        'phone',
        'type',   // customer | driver | guide
        'code',
        'expires_at',
        'is_used',
        'attempts',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'is_used' => 'boolean',
            'attempts' => 'integer',
        ];
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isUsed(): bool
    {
        return (bool) $this->is_used;
    }

    public function isValid(): bool
    {
        return ! $this->isExpired() && ! $this->isUsed();
    }

    /**
     * Resolve the Authenticatable model for this OTP's type.
     */
    public function resolveOwner(): ?\Illuminate\Foundation\Auth\User
    {
        return match ($this->type) {
            'customer' => Customer::where('phone', $this->phone)->first(),
            'driver' => Driver::where('phone', $this->phone)->first(),
            'guide' => Guide::where('phone', $this->phone)->first(),
            default => null,
        };
    }
}

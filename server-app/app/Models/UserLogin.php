<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class UserLogin extends Model
{
    protected $table = 'user_logins';

    public $timestamps = false; // Custom handled below

    protected $fillable = [
        'loginable_type',
        'loginable_id',
        'ip_address',
        'user_agent',
        'device_type',
        'login_method',
        'logged_in_at',
        'logged_out_at',
    ];

    protected $casts = [
        'logged_in_at' => 'datetime',
        'logged_out_at' => 'datetime',
    ];

    public function loginable(): MorphTo
    {
        return $this->morphTo();
    }
}

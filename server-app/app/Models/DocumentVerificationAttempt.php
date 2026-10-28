<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentVerificationAttempt extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['document_fingerprint', 'attributes'];

    protected $casts = ['simulated' => 'boolean', 'completed_at' => 'datetime', 'attributes' => 'encrypted:array', 'chargeable' => 'boolean'];
}

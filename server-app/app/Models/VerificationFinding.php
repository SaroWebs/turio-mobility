<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VerificationFinding extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected $casts = ['blocking' => 'boolean', 'non_overridable' => 'boolean', 'resolution_evidence' => 'encrypted:array'];
}

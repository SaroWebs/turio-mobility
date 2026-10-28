<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CarpoolPolicy extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['rules' => 'array', 'enabled' => 'boolean'];
}

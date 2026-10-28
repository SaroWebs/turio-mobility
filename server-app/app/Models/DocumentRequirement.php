<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentRequirement extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['enabled' => 'boolean', 'mandatory' => 'boolean', 'blocks_activation' => 'boolean', 'requires_expiry' => 'boolean', 'alternative_types' => 'array', 'second_review' => 'boolean'];
}

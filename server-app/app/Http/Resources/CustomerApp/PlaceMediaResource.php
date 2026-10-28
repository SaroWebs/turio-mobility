<?php

namespace App\Http\Resources\CustomerApp;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlaceMediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'path' => $this->path,
            'type' => $this->type,
            'caption' => $this->caption,
            'sort_order' => (int) ($this->sort_order ?? 0),
            'file_path' => $this->file_path,
            'file_type' => $this->file_type,
            'url' => $this->url,
            'source' => $this->source,
            'approval_status' => $this->approval_status,
        ];
    }
}

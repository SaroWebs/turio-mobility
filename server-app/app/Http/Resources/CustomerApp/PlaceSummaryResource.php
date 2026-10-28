<?php

namespace App\Http\Resources\CustomerApp;

use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlaceSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'short_description' => $this->short_description,
            'location' => $this->location,
            'city' => $this->city,
            'state' => $this->state,
            'country' => $this->country,
            'latitude' => $this->latitude === null ? null : (float) $this->latitude,
            'longitude' => $this->longitude === null ? null : (float) $this->longitude,
            'google_place_id' => $this->google_place_id,
            'google_rating' => $this->google_rating === null ? null : (float) $this->google_rating,
            'google_review_count' => (int) ($this->google_review_count ?? 0),
            'rating' => $this->rating === null ? null : (float) $this->rating,
            'review_count' => (int) ($this->review_count ?? 0),
            'cover_image' => MediaUrl::resolve($this->cover_image),
            'tags' => $this->tags ?? [],
            'media' => PlaceMediaResource::collection($this->whenLoaded('media')),
        ];
    }
}

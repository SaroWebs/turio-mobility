<?php

namespace App\Http\Resources\CustomerApp;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItineraryStopResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tour_id' => $this->tour_id,
            'place_id' => $this->place_id,
            'day_number' => (int) ($this->day_number ?? $this->day_index ?? 0),
            'day_index' => (int) ($this->day_index ?? $this->day_number ?? 0),
            'stop_order' => (int) ($this->stop_order ?? 1),
            'time' => $this->time,
            'title' => $this->title,
            'start_location' => $this->start_location,
            'end_location' => $this->end_location,
            'description' => $this->description,
            'details' => $this->details,
            'activities' => $this->activities ?? [],
            'accommodation' => $this->accommodation,
            'meals_included' => $this->meals_included ?? [],
            'distance_km' => $this->distance_km === null ? null : (float) $this->distance_km,
            'travel_time' => $this->travel_time,
            'key_stops' => $this->key_stops ?? [],
            'inclusions' => $this->inclusions ?? [],
            'exclusions' => $this->exclusions ?? [],
            'place' => new PlaceSummaryResource($this->whenLoaded('place')),
            'media' => $this->place && $this->place->relationLoaded('media')
                ? PlaceMediaResource::collection($this->place->media)
                : [],
        ];
    }
}

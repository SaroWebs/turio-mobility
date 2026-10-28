<?php

namespace App\Http\Resources\CustomerApp;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\URL;

class PlaceDetailResource extends JsonResource
{
    public function __construct($resource, protected ?Collection $activeTours = null)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return [
            'place' => new PlaceSummaryResource($this->resource),
            'media' => PlaceMediaResource::collection($this->whenLoaded('media')),
            'active_tours' => $this->activeTours ? TourResource::collection($this->activeTours) : [],
            'skyslope_reviews' => $this->whenLoaded('reviews'),
            'google_summary' => [
                'place_id' => $this->google_place_id,
                'rating' => $this->google_rating === null ? null : (float) $this->google_rating,
                'review_count' => (int) ($this->google_review_count ?? 0),
                'reviews' => $this->google_reviews ?? [],
                'photos' => collect($this->google_photos ?? [])->map(function (array $photo) {
                    $reference = $photo['photo_reference'] ?? null;

                    return [
                        ...$photo,
                        'url' => $reference ? URL::temporarySignedRoute(
                            'customer-app.google-place-photo',
                            now()->addDay(),
                            ['reference' => $reference],
                        ) : null,
                    ];
                })->values()->all(),
                'details' => $this->google_details ?? [],
                'coordinates' => [
                    'latitude' => $this->latitude === null ? null : (float) $this->latitude,
                    'longitude' => $this->longitude === null ? null : (float) $this->longitude,
                ],
                'last_synced_at' => optional($this->google_synced_at)->toIso8601String(),
            ],
        ];
    }
}

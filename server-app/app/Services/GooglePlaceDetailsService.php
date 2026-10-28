<?php

namespace App\Services;

use App\Models\Place;
use Illuminate\Support\Facades\Http;

class GooglePlaceDetailsService
{
    public function sync(Place $place, bool $force = false): array
    {
        if (! $place->google_place_id) {
            return [
                'status' => 'skipped',
                'message' => 'Place has no Google place id.',
            ];
        }

        if (! $force && $this->isFresh($place)) {
            return [
                'status' => 'fresh',
                'message' => 'Google place cache is still fresh.',
            ];
        }

        $apiKey = config('services.google_maps.api_key');
        if (! $apiKey) {
            return [
                'status' => 'skipped',
                'message' => 'Google Maps API key is not configured.',
            ];
        }

        $response = Http::timeout(8)->get('https://maps.googleapis.com/maps/api/place/details/json', [
            'place_id' => $place->google_place_id,
            'key' => $apiKey,
            'fields' => implode(',', [
                'place_id', 'name', 'formatted_address', 'formatted_phone_number',
                'international_phone_number', 'rating', 'user_ratings_total',
                'reviews', 'photos', 'geometry', 'opening_hours', 'website', 'url',
                'business_status', 'types', 'price_level', 'editorial_summary',
            ]),
        ]);

        if (! $response->ok()) {
            return [
                'status' => 'failed',
                'message' => 'Google Place Details request failed.',
                'http_status' => $response->status(),
            ];
        }

        $payload = $response->json();
        if (($payload['status'] ?? null) !== 'OK') {
            return [
                'status' => 'failed',
                'message' => $payload['error_message'] ?? 'Google Place Details returned a non-OK status.',
                'google_status' => $payload['status'] ?? null,
            ];
        }

        $result = $payload['result'] ?? [];
        $location = $result['geometry']['location'] ?? [];

        $place->update([
            'google_rating' => $result['rating'] ?? null,
            'google_review_count' => $result['user_ratings_total'] ?? 0,
            'google_reviews' => $this->mapReviews($result['reviews'] ?? []),
            'google_photos' => $this->mapPhotos($result['photos'] ?? []),
            'google_details' => $this->mapDetails($result),
            'latitude' => $location['lat'] ?? $place->latitude,
            'longitude' => $location['lng'] ?? $place->longitude,
            'google_synced_at' => now(),
        ]);

        return [
            'status' => 'synced',
            'message' => 'Google place details synced.',
            'place' => $place->fresh(),
        ];
    }

    public function isFresh(Place $place): bool
    {
        if (! $place->google_synced_at) {
            return false;
        }

        $ttlHours = (int) config('services.google_maps.cache_ttl_hours', 24);

        return $place->google_synced_at->greaterThan(now()->subHours($ttlHours));
    }

    private function mapReviews(array $reviews): array
    {
        return collect($reviews)
            ->take(5)
            ->map(fn (array $review) => [
                'author_name' => $review['author_name'] ?? null,
                'rating' => $review['rating'] ?? null,
                'relative_time_description' => $review['relative_time_description'] ?? null,
                'text' => $review['text'] ?? null,
                'time' => $review['time'] ?? null,
            ])
            ->values()
            ->all();
    }

    private function mapPhotos(array $photos): array
    {
        return collect($photos)
            ->take(10)
            ->map(fn (array $photo) => [
                'photo_reference' => $photo['photo_reference'] ?? null,
                'height' => $photo['height'] ?? null,
                'width' => $photo['width'] ?? null,
                'html_attributions' => $photo['html_attributions'] ?? [],
            ])
            ->values()
            ->all();
    }

    private function mapDetails(array $result): array
    {
        return [
            'name' => $result['name'] ?? null,
            'formatted_address' => $result['formatted_address'] ?? null,
            'formatted_phone_number' => $result['formatted_phone_number'] ?? null,
            'international_phone_number' => $result['international_phone_number'] ?? null,
            'opening_hours' => $result['opening_hours'] ?? null,
            'website' => $result['website'] ?? null,
            'google_maps_url' => $result['url'] ?? null,
            'business_status' => $result['business_status'] ?? null,
            'types' => $result['types'] ?? [],
            'price_level' => $result['price_level'] ?? null,
            'editorial_summary' => $result['editorial_summary']['overview'] ?? null,
        ];
    }
}

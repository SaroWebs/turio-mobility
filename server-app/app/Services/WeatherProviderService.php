<?php

namespace App\Services;

class WeatherProviderService
{
    public function snapshot(mixed $latitude, mixed $longitude): array
    {
        if (! $latitude || ! $longitude) {
            return [
                'summary' => 'Location pending',
                'temperature_c' => null,
                'source' => $this->source(),
            ];
        }

        $lat = abs((float) $latitude);
        $lng = abs((float) $longitude);
        $temperature = (int) round(22 + fmod($lat + $lng, 11));
        $summary = $temperature > 30 ? 'Warm and clear' : ($temperature < 24 ? 'Mild conditions' : 'Clear');

        return [
            'summary' => $summary,
            'temperature_c' => $temperature,
            'source' => $this->source(),
        ];
    }

    private function source(): string
    {
        try {
            return (string) (function_exists('config') ? config('services.weather.provider', 'fallback') : 'fallback');
        } catch (\Throwable) {
            return 'fallback';
        }
    }
}

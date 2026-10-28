<?php

namespace App\Http\Resources\CustomerApp;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TourScheduleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tour_id' => $this->tour_id,
            'departure_date' => optional($this->departure_date)->toDateString(),
            'return_date' => optional($this->return_date)->toDateString(),
            'departure_time' => $this->departure_time,
            'departure_point' => $this->departure_point,
            'total_seats' => (int) ($this->total_seats ?? 0),
            'booked_seats' => (int) ($this->booked_seats ?? 0),
            'reserved_seats' => (int) ($this->reserved_seats ?? 0),
            'available_seats' => method_exists($this->resource, 'getAvailableSeats') ? $this->getAvailableSeats() : null,
            'price_per_adult' => method_exists($this->resource, 'getEffectivePrice') ? $this->getEffectivePrice() : (float) ($this->price_override ?? 0),
            'price_per_child' => method_exists($this->resource, 'getEffectiveChildPrice') ? $this->getEffectiveChildPrice() : (float) ($this->child_price_override ?? 0),
            'price_override' => $this->price_override === null ? null : (float) $this->price_override,
            'child_price_override' => $this->child_price_override === null ? null : (float) $this->child_price_override,
            'status' => $this->status,
            'notes' => $this->notes,
        ];
    }
}

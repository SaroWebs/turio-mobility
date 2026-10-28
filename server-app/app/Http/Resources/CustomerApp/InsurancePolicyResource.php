<?php

namespace App\Http\Resources\CustomerApp;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InsurancePolicyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'policy_number' => $this->policy_number,
            'customer_id' => $this->customer_id,
            'coverable_type' => $this->coverable_type,
            'coverable_id' => $this->coverable_id,
            'policy_type' => $this->policy_type,
            'product_code' => $this->product_code,
            'provider_name' => $this->provider_name,
            'premium' => $this->premium === null ? null : (float) $this->premium,
            'coverage_amount' => $this->coverage_amount === null ? null : (float) $this->coverage_amount,
            'start_date' => optional($this->start_date)->toDateString(),
            'end_date' => optional($this->end_date)->toDateString(),
            'status' => $this->status,
            'terms' => $this->terms,
            'terms_version' => $this->terms_version,
            'terms_accepted_at' => optional($this->terms_accepted_at)->toIso8601String(),
            'issued_at' => optional($this->issued_at)->toIso8601String(),
            'cancelled_at' => optional($this->cancelled_at)->toIso8601String(),
            'is_active' => method_exists($this->resource, 'isActive') ? $this->isActive() : $this->status === 'active',
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}

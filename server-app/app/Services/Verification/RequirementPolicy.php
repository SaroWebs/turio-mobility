<?php

namespace App\Services\Verification;

use App\Models\DocumentRequirement;
use App\Models\Driver;
use App\Models\DriverDocument;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RequirementPolicy
{
    public function forDriver(Driver $driver, ?string $service = null): Collection
    {
        $services = $service ? [$service] : DB::table('driver_verification_cases')->where('driver_id', $driver->id)->pluck('service_category')->all();
        $category = $driver->vehicle()->value('car_category_id');

        return DocumentRequirement::where('enabled', true)->whereIn('service_category', $services)
            ->where(fn ($q) => $q->whereNull('vehicle_category_id')->when($category, fn ($q) => $q->orWhere('vehicle_category_id', $category)))->get();
    }

    public function forDocument(DriverDocument $document): Collection
    {
        return $this->forDriver($document->driver)->filter(fn ($r) => in_array($document->type, [$r->type, ...($r->alternative_types ?? [])], true));
    }

    public function subjectHash(Driver $driver): string
    {
        $driver = $driver->fresh() ?? $driver;
        $vehicle = $driver->vehicle;

        return hash('sha256', json_encode([$driver->name, $driver->date_of_birth?->toDateString(), $vehicle?->id,
            $vehicle?->registration_number, $vehicle?->car_category_id, $vehicle?->make, $vehicle?->model]));
    }
}

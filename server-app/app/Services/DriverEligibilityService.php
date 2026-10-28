<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;

class DriverEligibilityService
{
    /** A case explicitly enrolls a driver in the new policy; no silent legacy cutover. */
    public function evaluate(Driver $driver, string $service, ?Vehicle $vehicle = null): array
    {
        $case = DB::table('driver_verification_cases')->where('driver_id', $driver->id)->where('service_category', $service)->first();
        if (! $case) {
            return ['managed' => false, 'eligible' => true, 'reasons' => []];
        }
        $reasons = [];
        if ($case->status !== 'approved') {
            $reasons[] = 'Service verification case requires administrative approval.';
        }
        if (! $driver->is_active || ! $driver->is_approved || $driver->status !== 'active') {
            $reasons[] = 'Driver account is not active and approved.';
        }
        if ($case->vehicle_id && (! $vehicle || (int) $case->vehicle_id !== $vehicle->id
            || $vehicle->driver_id !== $driver->id || ! $vehicle->isApprovedForService())) {
            $reasons[] = 'The vehicle approved for this service is unavailable or noncompliant.';
        }
        $policy = app(\App\Services\Verification\RequirementPolicy::class);
        $requirements = $policy->forDriver($driver, $service)->where('blocks_activation', true);
        if ($requirements->isEmpty()) {
            $reasons[] = 'No approved requirements policy is configured for this service.';
        }
        $documents = $driver->documents()->get()->keyBy('type');
        foreach ($requirements as $requirement) {
            $accepted = collect([$requirement->type, ...($requirement->alternative_types ?? [])])->contains(function ($type) use ($documents, $requirement, $policy, $driver) {
                $document = $documents->get($type);

                return $document && $document->status === 'approved' && $document->verification_outcome === 'verified'
                    && ! $document->expires_at?->lt(today()) && (! $requirement->requires_expiry || $document->expires_at)
                    && (! $document->approved_subject_hash || hash_equals($document->approved_subject_hash, $policy->subjectHash($driver)))
                    && ! app(\App\Services\Verification\VerificationMatching::class)->blocked($document);
            });
            if (! $accepted) {
                $reasons[] = $requirement->label.' requires current evidence and approval.';
            }
        }

        return ['managed' => true, 'eligible' => $reasons === [], 'reasons' => $reasons];
    }
}

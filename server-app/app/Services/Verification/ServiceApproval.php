<?php

namespace App\Services\Verification;

use App\Models\Driver;
use App\Models\User;
use App\Services\DriverEligibilityService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ServiceApproval
{
    public const SERVICES = ['short_ride', 'long_ride', 'carpool', 'rental', 'tour'];

    public function decide(Driver $driver, User $actor, array $data): void
    {
        abort_unless($actor->hasPermission('verification.approve_driver'), 403);
        DB::transaction(function () use ($driver, $actor, $data) {
            $driver = Driver::whereKey($driver->id)->lockForUpdate()->firstOrFail();
            $case = DB::table('driver_verification_cases')->where('driver_id', $driver->id)->where('service_category', $data['service'])->lockForUpdate()->first();
            $requirements = app(RequirementPolicy::class)->forDriver($driver, $data['service']);
            if ($requirements->isEmpty()) {
                throw ValidationException::withMessages(['service' => 'Publish a reviewed service requirements policy before enrolling this driver.']);
            }
            $vehicle = $driver->vehicle()->lockForUpdate()->first();
            $vehicleId = $requirements->contains('level', 'vehicle') ? $vehicle?->id : null;
            if ($requirements->contains('level', 'vehicle') && ! $vehicleId) {
                throw ValidationException::withMessages(['service' => 'Register a vehicle before reviewing this service.']);
            }
            if (! $case && $data['status'] !== 'under_review') {
                throw ValidationException::withMessages(['status' => 'Enroll the driver for review before issuing a service decision.']);
            }
            DB::table('driver_verification_cases')->updateOrInsert(['driver_id' => $driver->id, 'service_category' => $data['service']], [
                'vehicle_id' => $vehicleId, 'status' => $data['status'], 'reviewed_by' => $actor->id,
                'reason' => $data['reason'], 'created_at' => $case?->created_at ?? now(), 'updated_at' => now(),
            ]);
            if ($data['status'] === 'approved') {
                $result = app(DriverEligibilityService::class)->evaluate($driver, $data['service'], $vehicle);
                if (! $result['eligible']) {
                    throw ValidationException::withMessages(['status' => implode(' ', $result['reasons'])]);
                }
            }
            DB::table('verification_policy_events')->insert([
                'actor_id' => $actor->id, 'action' => 'service_decision', 'subject' => 'driver:'.$driver->id,
                'reason' => $data['reason'], 'details' => json_encode(['service' => $data['service'], 'from' => $case?->status, 'to' => $data['status'], 'vehicle_id' => $vehicleId]), 'created_at' => now(),
            ]);
            DB::table('verification_notices')->insert([
                'driver_id' => $driver->id, 'dedup_key' => 'case:'.\Illuminate\Support\Str::uuid(),
                'message' => 'Your '.$data['service'].' eligibility is '.str_replace('_', ' ', $data['status']).'.', 'created_at' => now(),
            ]);
        });
    }
}

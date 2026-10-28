<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerApp\InsurancePolicyResource;
use App\Models\DriverInsurancePolicy;
use App\Models\ExtendedCare;
use App\Models\InsuranceClaim;
use App\Models\InsurancePolicy;
use App\Services\InsurancePlanCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class InsuranceController extends Controller
{
    public function getDriverPolicies(Request $request)
    {
        if (! $request->user()->isDriver()) {
            return response()->json(['success' => false, 'message' => 'Only driver accounts can access driver insurance.'], 403);
        }

        $policies = DriverInsurancePolicy::where('driver_id', $request->user()->id)
            ->with('vehicle:id,registration_number,make,model')->latest()->get()
            ->map(fn (DriverInsurancePolicy $policy) => [
                'id' => $policy->id,
                'policy_number' => $policy->policy_number,
                'product_code' => $policy->product_code,
                'provider_name' => $policy->provider_name,
                'coverage_amount' => (float) $policy->coverage_amount,
                'premium' => $policy->premium === null ? null : (float) $policy->premium,
                'start_date' => $policy->start_date->toDateString(),
                'end_date' => $policy->end_date->toDateString(),
                'status' => $policy->status,
                'verified_at' => optional($policy->verified_at)->toIso8601String(),
                'is_active' => $policy->isActive(),
                'vehicle' => $policy->vehicle,
            ]);

        return response()->json(['success' => true, 'data' => $policies]);
    }

    public function getPlans(Request $request, InsurancePlanCatalog $catalog)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $catalog->publicPlans(),
            'disclosure' => 'Coverage is optional and applies only to the linked booking. Benefits, exclusions, cancellation rules, and the named provider must be reviewed before acceptance.',
        ]);
    }

    /**
     * Get user's insurance policies
     */
    public function getPolicies(Request $request)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $policies = InsurancePolicy::where('customer_id', $request->user()->id)
            ->with(['claims'])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => InsurancePolicyResource::collection($policies)->resolve($request),
        ]);
    }

    /**
     * Get insurance policy by ID
     */
    public function getPolicy(Request $request, $id)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $policy = InsurancePolicy::where('customer_id', $request->user()->id)
            ->where('id', $id)
            ->with(['claims'])
            ->first();

        if (! $policy) {
            return response()->json([
                'success' => false,
                'message' => 'Policy not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => (new InsurancePolicyResource($policy))->resolve($request),
        ]);
    }

    /**
     * Create new insurance policy
     */
    public function createPolicy(Request $request, InsurancePlanCatalog $catalog)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'plan_code' => 'required|string',
            'service_type' => 'required|in:ride,tour,rental',
            'booking_id' => 'required|integer|min:1',
            'terms_accepted' => 'accepted',
            'terms_version' => 'required|string|in:'.InsurancePlanCatalog::TERMS_VERSION,
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $plan = $catalog->plan($request->string('plan_code')->toString());
        if (! $catalog->isConfigured()) {
            return response()->json([
                'success' => false,
                'message' => 'Insurance issuance is temporarily unavailable until the licensed provider and policy wording are configured.',
            ], 503);
        }
        if ($plan['service_type'] !== $request->string('service_type')->toString()) {
            return response()->json(['success' => false, 'errors' => ['plan_code' => ['This plan does not cover the selected service.']]], 422);
        }

        $booking = $catalog->customerBooking($plan['service_type'], $request->integer('booking_id'), $request->user()->id);

        if (InsurancePolicy::whereMorphedTo('coverable', $booking)->exists()) {
            return response()->json(['success' => false, 'message' => 'This booking already has an insurance policy.'], 409);
        }

        $policy = DB::transaction(fn () => InsurancePolicy::create([
            'customer_id' => $request->user()->id,
            'policy_number' => InsurancePolicy::generatePolicyNumber(),
            'coverable_type' => $booking->getMorphClass(),
            'coverable_id' => $booking->getKey(),
            'policy_type' => $plan['policy_type'],
            'product_code' => $plan['code'],
            'provider_name' => config('services.insurance.provider_name'),
            'coverage_amount' => $plan['coverage_amount'],
            'premium' => $plan['premium'],
            'start_date' => today(),
            'end_date' => today()->addDays($plan['duration_days']),
            'status' => 'active',
            'terms' => 'Accepted insurance policy terms, including stated benefits, exclusions, claim requirements, and cancellation rules.',
            'terms_version' => InsurancePlanCatalog::TERMS_VERSION,
            'terms_accepted_at' => now(),
            'issued_at' => now(),
        ]));

        return response()->json([
            'success' => true,
            'data' => (new InsurancePolicyResource($policy))->resolve($request),
            'message' => 'Insurance policy created successfully',
        ], 201);
    }

    /**
     * Update insurance policy
     */
    public function updatePolicy(Request $request, $id)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $policy = InsurancePolicy::where('customer_id', $request->user()->id)
            ->where('id', $id)
            ->first();

        if (! $policy) {
            return response()->json([
                'success' => false,
                'message' => 'Policy not found',
            ], 404);
        }

        return response()->json([
            'success' => false,
            'message' => 'Issued insurance terms, price, coverage, and status are immutable. Cancel the policy or contact support for corrections.',
        ], 409);
    }

    /**
     * Cancel insurance policy
     */
    public function cancelPolicy(Request $request, $id)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $policy = InsurancePolicy::where('customer_id', $request->user()->id)
            ->where('id', $id)
            ->first();

        if (! $policy) {
            return response()->json([
                'success' => false,
                'message' => 'Policy not found',
            ], 404);
        }

        if ($policy->status !== 'active') {
            return response()->json(['success' => false, 'message' => 'Only active policies can be cancelled.'], 409);
        }

        $policy->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Policy cancelled successfully',
        ]);
    }

    /**
     * Get user's claims
     */
    public function getClaims(Request $request)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $claims = InsuranceClaim::where('customer_id', $request->user()->id)
            ->with(['policy'])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $claims,
        ]);
    }

    /**
     * Create new claim
     */
    public function createClaim(Request $request)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'insurance_policy_id' => 'required_without:insurance_id|exists:insurance_policies,id',
            'insurance_id' => 'required_without:insurance_policy_id|exists:insurance_policies,id',
            'incident_date' => 'required|date|before_or_equal:today',
            'incident_description' => 'required|string|max:1000',
            'claim_amount' => 'required|numeric|min:100',
            'documents' => 'nullable|array',
            'documents.*' => 'string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        // Verify insurance belongs to user
        $insurancePolicyId = $request->insurance_policy_id ?? $request->insurance_id;

        $insurance = InsurancePolicy::where('customer_id', $request->user()->id)
            ->where('id', $insurancePolicyId)
            ->first();

        if (! $insurance) {
            return response()->json([
                'success' => false,
                'message' => 'Insurance policy not found or does not belong to you',
            ], 404);
        }

        if (! $insurance->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Insurance policy is not active',
            ], 400);
        }

        $claim = InsuranceClaim::create([
            'insurance_policy_id' => $insurance->id,
            'customer_id' => $request->user()->id,
            'claim_number' => InsuranceClaim::generateClaimNumber(),
            'incident_date' => $request->incident_date,
            'description' => $request->incident_description,
            'documents' => $request->documents,
            'claim_amount' => $request->claim_amount,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'data' => $claim,
            'message' => 'Claim submitted successfully',
        ], 201);
    }

    /**
     * Get user's extended care requests
     */
    public function getExtendedCare(Request $request)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $careRequests = ExtendedCare::where('customer_id', $request->user()->id)
            ->with(['serviceable'])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $careRequests,
        ]);
    }

    /**
     * Request emergency assistance
     */
    public function requestAssistance(Request $request)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'care_type' => 'required|in:emergency,roadside,medical,legal',
            'notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $care = ExtendedCare::create([
            'customer_id' => $request->user()->id,
            'care_type' => $request->care_type,
            'description' => $request->notes,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'data' => $care,
            'message' => 'Assistance requested successfully',
        ], 201);
    }

    /**
     * Cancel assistance request
     */
    public function cancelAssistance(Request $request, $id)
    {
        if (! $request->user()->isCustomer()) {
            return response()->json(['success' => false, 'message' => 'Only customer accounts can access insurance.'], 403);
        }

        $care = ExtendedCare::where('customer_id', $request->user()->id)
            ->where('id', $id)
            ->first();

        if (! $care) {
            return response()->json([
                'success' => false,
                'message' => 'Assistance request not found',
            ], 404);
        }

        if (in_array($care->status, ['completed', 'cancelled'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot cancel completed or cancelled request',
            ], 400);
        }

        $care->update(['status' => 'cancelled']);

        return response()->json([
            'success' => true,
            'message' => 'Assistance request cancelled successfully',
        ]);
    }
}

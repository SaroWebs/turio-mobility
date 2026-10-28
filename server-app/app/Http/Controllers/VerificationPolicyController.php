<?php

namespace App\Http\Controllers;

use App\Models\DocumentRequirement;
use App\Models\Driver;
use App\Services\Verification\ServiceApproval;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class VerificationPolicyController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasPermission('verification.manage_requirements'), 403);

        return Inertia::render('admin/Verification/Requirements', ['requirements' => DocumentRequirement::orderBy('service_category')->get(), 'services' => ServiceApproval::SERVICES, 'categories' => \App\Models\CarCategory::select('id', 'name')->get()]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->hasPermission('verification.manage_requirements'), 403);
        if (is_array($request->input('alternative_types'))) {
            $request->merge(['alternative_types' => array_values(array_filter(array_map(fn ($value) => is_string($value) ? trim($value) : $value, $request->input('alternative_types'))))]);
        }
        $data = $request->validate([
            'type' => ['required', 'regex:/^[a-z][a-z0-9_]{1,59}$/'], 'label' => ['required', 'string', 'max:150'],
            'service_category' => ['required', Rule::in(ServiceApproval::SERVICES)], 'level' => ['required', Rule::in(['identity', 'driving', 'vehicle'])],
            'mandatory' => ['required', 'boolean'], 'blocks_activation' => ['required', 'boolean'], 'requires_expiry' => ['required', 'boolean'],
            'verification_method' => ['required', Rule::in(['manual', 'manual_or_api'])], 'max_submissions' => ['required', 'integer', 'min:1', 'max:10'],
            'enabled' => ['required', 'boolean'], 'reason' => ['required', 'string', 'max:2000'],
            'vehicle_category_id' => ['nullable', 'integer', 'exists:car_categories,id'],
            'alternative_types' => ['sometimes', 'array', 'max:10'], 'alternative_types.*' => ['string', 'distinct', 'regex:/^[a-z][a-z0-9_]{1,59}$/', 'not_in:aadhaar'],
            'licence_class' => ['nullable', 'string', 'max:40'], 'licence_scope' => ['nullable', Rule::in(['transport', 'non_transport'])],
            'second_review' => ['sometimes', 'boolean'],
        ]);
        $data['scope_key'] = empty($data['vehicle_category_id']) ? 'all' : 'category:'.$data['vehicle_category_id'];
        DB::transaction(function () use ($data, $request) {
            $existing = DocumentRequirement::where('type', $data['type'])->where('service_category', $data['service_category'])->where('scope_key', $data['scope_key'])->lockForUpdate()->first();
            abort_if($existing?->enabled, 422, 'Published requirements are locked. Weakening or replacing an active policy requires a separate compliance migration.');
            $attributes = collect($data)->except('reason')->all();
            $record = $existing ?: new DocumentRequirement;
            $record->fill($attributes)->save();
            DB::table('verification_policy_events')->insert([
                'actor_id' => $request->user()->id, 'action' => $data['enabled'] ? 'requirement_published' : 'requirement_draft',
                'subject' => 'requirement:'.$record->id, 'reason' => $data['reason'], 'details' => json_encode($attributes), 'created_at' => now(),
            ]);
        });

        return back()->with('success', 'Document requirement saved.');
    }

    public function service(Request $request, Driver $driver, ServiceApproval $approval)
    {
        $data = $request->validate(['service' => ['required', Rule::in(ServiceApproval::SERVICES)],
            'status' => ['required', Rule::in(['under_review', 'approved', 'rejected', 'suspended', 'reverification_required'])],
            'reason' => ['required', 'string', 'max:2000']]);
        $approval->decide($driver, $request->user(), $data);

        return back()->with('success', 'Service eligibility decision recorded.');
    }
}

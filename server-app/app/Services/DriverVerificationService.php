<?php

namespace App\Services;

use App\Models\Driver;

class DriverVerificationService
{
    // Product requirements, shared by onboarding and administrator activation.
    public const DOCUMENTS = [
        'driving_license' => ['label' => 'Driving licence', 'number_label' => 'Licence number', 'required' => true, 'has_expiry' => true],
        'government_id' => ['label' => 'Accepted identity document', 'number_label' => 'ID number (do not enter Aadhaar)', 'required' => true, 'has_expiry' => false],
        'vehicle_rc' => ['label' => 'Vehicle registration certificate (RC)', 'number_label' => 'Registration number', 'required' => true, 'has_expiry' => true],
        'police_verification' => ['label' => 'Police verification', 'number_label' => 'Reference number', 'required' => false, 'has_expiry' => true],
        'tax_id' => ['label' => 'PAN / tax ID', 'number_label' => 'PAN number', 'required' => false, 'has_expiry' => false],
    ];

    public function summary(Driver $driver): array
    {
        $documents = $driver->documents()->get()->keyBy('type');
        $definitions = self::DOCUMENTS;
        $services = \Illuminate\Support\Facades\DB::table('driver_verification_cases')->where('driver_id', $driver->id)->pluck('service_category');
        if ($services->isNotEmpty()) {
            $definitions = [];
        }
        foreach (app(\App\Services\Verification\RequirementPolicy::class)->forDriver($driver) as $requirement) {
            $types = [$requirement->type, ...($requirement->alternative_types ?? [])];
            $selected = collect($types)->first(fn ($type) => $documents->get($type)?->status === 'approved') ?? $requirement->type;
            foreach ($types as $type) {
                $definitions[$type] = ['label' => $type === $requirement->type ? $requirement->label : ucwords(str_replace('_', ' ', $type)).' (accepted alternative)', 'number_label' => 'Document number', 'required' => ($definitions[$type]['required'] ?? false) || ($requirement->mandatory && $type === $selected), 'has_expiry' => ($definitions[$type]['has_expiry'] ?? false) || $requirement->requires_expiry, 'alternatives' => $types];
            }
        }
        $requirements = collect($definitions)->map(function (array $definition, string $type) use ($documents, $driver) {
            $document = $documents->get($type);
            $status = $document?->status ?? 'missing';
            if ($document?->expires_at && $document->expires_at->lt(today()) && in_array($status, \App\Services\Verification\DocumentWorkflow::ACTIONS['expired'], true)) {
                $status = 'expired';
            }
            if ($status === 'approved' && $document->approved_subject_hash && ! hash_equals($document->approved_subject_hash, app(\App\Services\Verification\RequirementPolicy::class)->subjectHash($driver))) {
                $status = 'inconclusive';
            }

            return [
                'type' => $type,
                ...$definition,
                'status' => $status,
                'rejection_reason' => $document?->rejection_reason,
                'expires_at' => $document?->expires_at?->toDateString(),
                'document_id' => $document?->id,
                'version' => $document?->version ?? 0,
                'remaining_attempts' => max(0, app(\App\Services\Verification\DocumentWorkflow::class)->maxAttempts($type, $driver->id) + ($document?->extra_attempts ?? 0) - ($document ? max(1, $document->version) : 0)),
                'can_submit' => ! $document || in_array($status, ['rejected', 'correction_required', 'expired'], true),
            ];
        })->values();
        $required = $requirements->where('required', true);
        $incomplete = $required->where('status', '!=', 'approved');
        $actionable = $incomplete->whereIn('status', ['missing', 'rejected', 'correction_required', 'expired']);
        $status = $required->isEmpty() ? 'action_required' : ($incomplete->isEmpty() ? 'complete' : ($actionable->isEmpty() ? 'in_review' : 'action_required'));

        return [
            'required_types' => $required->pluck('type')->all(),
            'missing_or_unverified' => $incomplete->pluck('type')->all(),
            'is_complete' => $required->isNotEmpty() && $incomplete->isEmpty(),
            'status' => $status,
            'approved_count' => $required->where('status', 'approved')->count(),
            'required_count' => $required->count(),
            'next_document' => $actionable->sortBy(fn ($item) => match ($item['status']) {
                'rejected' => 0, 'expired' => 1, default => 2,
            })->first()['type'] ?? null,
            'message' => match ($status) {
                'complete' => 'All required driver documents are approved.',
                'in_review' => 'Your documents are being reviewed. No upload is needed right now.',
                default => 'Add or correct the marked documents. Approved documents do not need to be uploaded again.',
            },
            'requirements' => $requirements->all(),
        ];
    }
}

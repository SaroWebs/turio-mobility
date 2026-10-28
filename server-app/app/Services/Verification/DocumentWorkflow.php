<?php

namespace App\Services\Verification;

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\User;
use App\Models\VerificationReview;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class DocumentWorkflow
{
    public const ACTIONS = [
        'under_review' => ['pending'],
        'manual_verification_pending' => ['pending', 'under_review', 'inconclusive', 'flagged'],
        'manually_verified' => ['pending', 'under_review', 'manual_verification_pending', 'inconclusive'],
        'inconclusive' => ['pending', 'under_review', 'manual_verification_pending'],
        'approved' => ['manually_verified', 'api_verified'],
        'correction_required' => ['pending', 'under_review', 'manual_verification_pending', 'manually_verified', 'api_verified', 'inconclusive', 'flagged', 'suspended'],
        'rejected' => ['pending', 'under_review', 'manual_verification_pending', 'manually_verified', 'api_verified', 'inconclusive', 'flagged'],
        'flagged' => ['pending', 'under_review', 'manually_verified', 'api_verified', 'inconclusive', 'manual_verification_pending'],
        'suspended' => ['approved'],
        'expired' => ['approved', 'manually_verified', 'api_verified', 'pending', 'under_review', 'manual_verification_pending'],
    ];

    public function maxAttempts(string $type, ?int $driverId = null): int
    {
        $driver = Driver::find($driverId);

        return $driver ? (int) (app(RequirementPolicy::class)->forDriver($driver)->filter(fn ($r) => in_array($type, [$r->type, ...($r->alternative_types ?? [])], true))->min('max_submissions') ?? 3) : 3;
    }

    public function submit(Driver $driver, array $data, UploadedFile $file): DriverDocument
    {
        $path = null;
        try {
            return DB::transaction(function () use ($driver, $data, $file, &$path) {
                Driver::whereKey($driver->id)->lockForUpdate()->firstOrFail();
                $document = $driver->documents()->where('type', $data['type'])->lockForUpdate()->first();
                if ($document && ! in_array($document->status, ['correction_required', 'rejected', 'expired'], true)
                    && ! ($document->expires_at?->lt(today()) && in_array($document->status, self::ACTIONS['expired'], true))) {
                    $this->fail('A replacement must be authorized by a reviewer or the document must have expired.');
                }
                $used = $document ? max(1, $document->version) : 0;
                if ($used >= $this->maxAttempts($data['type'], $driver->id) + ($document?->extra_attempts ?? 0)) {
                    $this->fail('Submission attempts exhausted. Submit an appeal or request an administrative reopening.');
                }
                $checksum = hash_file('sha256', $file->getRealPath());
                if ($document?->versions()->where('checksum', $checksum)->exists()) {
                    $this->fail('This file was already submitted. Please provide a corrected document.');
                }
                if (str_starts_with($file->getMimeType(), 'image/')) {
                    $size = @getimagesize($file->getRealPath());
                    if (! $size || min($size[0], $size[1]) < 300) {
                        $this->fail('Upload a readable image at least 300 pixels on each side.');
                    }
                }
                $services = DB::table('driver_verification_cases')->where('driver_id', $driver->id)->pluck('service_category');
                $requiresExpiry = app(RequirementPolicy::class)->forDriver($driver)->contains(fn ($r) => $r->requires_expiry && in_array($data['type'], [$r->type, ...($r->alternative_types ?? [])], true));
                if ($requiresExpiry && empty($data['expires_at'])) {
                    $this->fail('An expiry date is required for this document.');
                }
                if ($document && $document->version === 0) {
                    $document->versions()->create([
                        'version' => 1, 'file_path' => $document->file_path, 'storage_disk' => $document->storage_disk,
                        'mime_type' => 'application/octet-stream', 'encrypted_number' => $document->document_number,
                        'expires_at' => $document->expires_at, 'created_at' => $document->created_at,
                    ]);
                }
                $path = $file->store('driver-documents/'.$driver->id, 'local');
                if (! $path) {
                    throw new \RuntimeException('Private document storage unavailable.');
                }
                $from = $document?->status ?? 'not_submitted';
                $document ??= new DriverDocument(['driver_id' => $driver->id, 'type' => $data['type']]);
                $document->fill([
                    'file_path' => $path, 'storage_disk' => 'local', 'version' => $used + 1,
                    'encrypted_number' => $data['document_number'] ?? null, 'document_number' => null,
                    'expires_at' => $data['expires_at'] ?? null, 'checksum' => $checksum,
                    'status' => 'pending', 'verification_outcome' => 'unverified',
                    'rejection_reason' => null, 'reviewed_at' => null, 'reviewed_by' => null,
                    'approved_subject_hash' => null, 'evidence_subject_hash' => null,
                ])->save();
                $document->versions()->create([
                    'version' => $document->version, 'file_path' => $path, 'storage_disk' => 'local',
                    'checksum' => $checksum, 'mime_type' => $file->getMimeType(),
                    'encrypted_number' => $document->encrypted_number, 'expires_at' => $document->expires_at,
                    'consented_at' => now(), 'created_at' => now(),
                ]);
                $this->audit($document, null, 'submitted', $from, 'Driver submitted a new document version.');
                $this->notice($document, 'submitted', 'Document submitted for human review.');

                return $document;
            });
        } catch (\Throwable $error) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }
            throw $error;
        }
    }

    public function decide(DriverDocument $document, User $actor, array $data): DriverDocument
    {
        $action = $data['action'];
        $permission = match ($action) {
            'approved' => 'approve_document', 'rejected' => 'reject_document',
            'correction_required' => 'request_correction', 'manually_verified', 'manual_verification_pending', 'inconclusive' => 'manual_check',
            'flagged', 'suspended', 'reopen' => 'escalate', default => 'review',
        };
        abort_unless($actor->hasPermission('verification.'.$permission), 403);

        return DB::transaction(function () use ($document, $actor, $data, $action) {
            Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
            $current = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
            if ($current->version !== (int) $data['version']) {
                $this->fail('This document has changed. Reload and review the current version.');
            }
            if (trim($data['reason'] ?? '') === '') {
                $this->fail('A reason is required for every review decision.');
            }
            $from = $current->status;
            if (in_array($from, ['flagged', 'suspended'], true)) {
                abort_unless($actor->hasPermission('verification.escalate'), 403);
            }
            if ($action === 'reopen') {
                if (! in_array($from, ['rejected', 'correction_required', 'flagged', 'suspended', 'expired'], true)) {
                    $this->fail('Only a closed or correction case can be reopened.');
                }
                $current->extra_attempts++;
                $current->status = 'correction_required';
                $current->verification_outcome = 'unverified';
            } else {
                if (! in_array($from, self::ACTIONS[$action] ?? [], true)) {
                    $this->fail("Cannot change {$from} to {$action}.");
                }
                if ($action === 'manually_verified') {
                    if (app(VerificationMatching::class)->blocked($current)) {
                        $this->fail('Resolve blocking findings with supporting evidence before recording a verified outcome. Confirmed prohibitions cannot be overridden.');
                    }
                    foreach (['method', 'source', 'checked_at', 'findings', 'reference'] as $field) {
                        if (empty($data['evidence'][$field])) {
                            $this->fail('Record method, source, checked time, reference and findings before verifying.');
                        }
                    }
                    if (\Carbon\Carbon::parse($data['evidence']['checked_at'])->isFuture()) {
                        $this->fail('The evidence check date cannot be in the future.');
                    }
                    $current->verification_outcome = 'verified';
                    $current->evidence_subject_hash = app(RequirementPolicy::class)->subjectHash($current->driver);
                }
                if (in_array($action, ['approved', 'manually_verified'], true)) {
                    $services = DB::table('driver_verification_cases')->where('driver_id', $current->driver_id)->pluck('service_category');
                    if (! $current->expires_at && app(RequirementPolicy::class)->forDocument($current)->contains('requires_expiry', true)) {
                        $this->fail('This requirement needs a valid expiry date before approval.');
                    }
                    if ($current->expires_at?->lt(today())) {
                        $this->fail('Expired documents cannot be verified or approved.');
                    }
                    if ($current->storage_disk !== 'local' || $current->version < 1) {
                        $this->fail('Migrate this legacy document to private versioned storage before approval.');
                    }
                }
                if ($action === 'approved' && $current->verification_outcome !== 'verified') {
                    $this->fail('Current, authoritative verification evidence is required.');
                }
                if ($action === 'approved') {
                    if (! $current->evidence_subject_hash || ! hash_equals($current->evidence_subject_hash, app(RequirementPolicy::class)->subjectHash($current->driver))) {
                        $this->fail('Driver or vehicle details changed since evidence was checked. Request a fresh verification.');
                    }
                    if (app(VerificationMatching::class)->blocked($current)) {
                        $this->fail('Unresolved blocking findings prevent approval.');
                    }
                    $requirements = app(RequirementPolicy::class)->forDocument($current);
                    if ($requirements->contains('verification_method', 'manual') && $from !== 'manually_verified') {
                        $this->fail('This policy requires an independent manual check.');
                    }
                    if ($current->requires_second_review || $requirements->contains('second_review', true)) {
                        $first = VerificationReview::where('driver_document_id', $current->id)->where('version', $current->version)->where('action', 'first_approval')->latest('id')->first();
                        if ($first && VerificationReview::where('driver_document_id', $current->id)->where('id', '>', $first->id)->whereNotIn('action', ['preview', 'first_approval'])->exists()) {
                            $first = null;
                        }
                        if (! $first) {
                            $this->audit($current, $actor, 'first_approval', $from, $data['reason']);

                            return $current;
                        }
                        if ($first->actor_id === $actor->id) {
                            $this->fail('A different senior reviewer must provide the second approval.');
                        }
                        abort_unless($actor->hasPermission('verification.second_review'), 403);
                    }
                    $current->approved_subject_hash = app(RequirementPolicy::class)->subjectHash($current->driver);
                }
                if ($action === 'flagged') {
                    $current->requires_second_review = true;
                }
                $current->status = $action;
            }
            $current->rejection_reason = in_array($current->status, ['correction_required', 'rejected', 'expired'], true) ? $data['reason'] : null;
            $current->reviewed_by = $actor->id;
            $current->reviewed_at = now();
            $current->save();
            $this->audit($current, $actor, $action, $from, $data['reason'], $data['evidence'] ?? null);
            $this->notice($current, $action.'-'.$current->extra_attempts.'-'.now()->format('Uu'), 'Document status: '.str_replace('_', ' ', $current->status).'.');

            return $current;
        });
    }

    public function audit(DriverDocument $document, ?User $actor, string $action, string $from, string $reason, ?array $evidence = null): void
    {
        VerificationReview::create([
            'driver_document_id' => $document->id, 'version' => $document->version, 'actor_id' => $actor?->id,
            'action' => $action, 'from_status' => $from, 'to_status' => $document->status,
            'reason' => $reason, 'evidence' => $evidence, 'created_at' => now(),
        ]);
    }

    public function providerEvidence(DriverDocument $document, \App\Models\DocumentVerificationAttempt $attempt, \App\Services\DocumentVerification\VerificationResult $result): void
    {
        if ($attempt->simulated || ! in_array($document->status, ['pending', 'under_review', 'inconclusive', 'api_verified'], true)) {
            return;
        }
        $from = $document->status;
        $findings = app(VerificationMatching::class)->record($document, $result->attributes, $attempt->id);
        $verified = $result->status === 'approved' && ($result->attributes['valid'] ?? null) === true && ! app(VerificationMatching::class)->blocked($document);
        $document->update(['status' => $verified ? 'api_verified' : 'inconclusive', 'verification_outcome' => $verified ? 'verified' : 'inconclusive', 'evidence_subject_hash' => $verified ? app(RequirementPolicy::class)->subjectHash($document->driver) : null]);
        $this->audit($document, null, 'provider_evidence', $from, 'Provider evidence recorded; human approval is still required.', ['attempt_id' => $attempt->id, 'finding_count' => count($findings)]);
        $this->notice($document, 'provider-'.$attempt->id, 'Document verification completed. Awaiting review.');
    }

    public function notice(DriverDocument $document, string $event, string $message): void
    {
        DB::table('verification_notices')->insertOrIgnore([
            'driver_id' => $document->driver_id, 'dedup_key' => "{$document->id}:{$document->version}:{$event}",
            'message' => $message, 'created_at' => now(),
        ]);
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['document' => $message]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\DriverDocumentVersion;
use App\Models\VerificationReview;
use App\Services\Verification\DocumentWorkflow;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class VerificationController extends Controller
{
    private function authorizeView(Request $request): void
    {
        abort_unless($request->user()?->hasPermission('verification.view'), 403);
    }

    public function index(Request $request)
    {
        $this->authorizeView($request);
        $query = Driver::whereHas('documents')->withCount('documents');
        if ($search = $request->string('search')->toString()) {
            $query->where('name', 'like', '%'.substr($search, 0, 100).'%');
        }
        if ($status = $request->string('status')->toString()) {
            $query->whereHas('documents', fn ($q) => $q->where('status', $status));
        }

        return Inertia::render('admin/Verification/Index', [
            'drivers' => $query->orderByDesc('updated_at')->paginate(20)->withQueryString()->through(fn ($driver) => [
                'id' => $driver->id, 'name' => $driver->name, 'phone' => '******'.substr($driver->phone, -4),
                'documents_count' => $driver->documents_count, 'status' => $driver->status,
            ]),
            'filters' => $request->only('search', 'status'),
        ]);
    }

    public function show(Request $request, Driver $driver)
    {
        $this->authorizeView($request);
        $documents = $driver->documents()->with('versions')->get()->map(function ($document) use ($request) {
            return [...$document->toArray(), 'versions' => $document->versions->map(fn ($version) => [
                'id' => $version->id, 'version' => $version->version, 'created_at' => $version->created_at,
                'url' => $version->storage_disk === 'local' && ! $version->purged_at ? URL::temporarySignedRoute('admin.verification.preview', now()->addMinutes(5), ['version' => $version->id, 'actor' => $request->user()->id]) : null,
                'legal_hold' => (bool) $version->legal_hold, 'purged_at' => $version->purged_at,
            ])];
        });

        return Inertia::render('admin/Verification/Show', [
            'driver' => $driver->only('id', 'name', 'status'), 'documents' => $documents,
            'reviews' => $request->user()->hasPermission('verification.view_audit_logs')
                ? VerificationReview::whereIn('driver_document_id', $documents->pluck('id'))->latest('id')->limit(100)->get() : [],
            'permissions' => $request->user()->roles->flatMap(fn ($role) => $role->permissions->pluck('name'))->unique()->values(),
            'appeals' => DB::table('verification_appeals')->whereIn('driver_document_id', $documents->pluck('id'))->latest('id')->get(),
            'service_cases' => DB::table('driver_verification_cases')->where('driver_id', $driver->id)->get(),
            'providers' => app(\App\Services\DocumentVerification\DocumentVerifier::class)->catalog(),
            'findings' => \App\Models\VerificationFinding::whereIn('driver_document_id', $documents->pluck('id'))->get(),
            'attempts' => \App\Models\DocumentVerificationAttempt::whereIn('driver_document_id', $documents->pluck('id'))->latest('id')->limit(100)->get()->map(fn ($attempt) => [...$attempt->toArray(), 'checked_attributes' => array_keys($attempt->attributes ?? [])]),
        ]);
    }

    public function decision(Request $request, DriverDocument $document, DocumentWorkflow $workflow)
    {
        $data = $request->validate([
            'version' => ['required', 'integer', 'min:0'],
            'action' => ['required', Rule::in([...array_keys(DocumentWorkflow::ACTIONS), 'reopen'])],
            'reason' => ['required', 'string', 'max:2000'],
            'evidence' => ['nullable', 'array:method,source,checked_at,findings,reference'],
            'evidence.method' => ['required_if:action,manually_verified', 'string', 'max:200'],
            'evidence.source' => ['required_if:action,manually_verified', 'string', 'max:500'],
            'evidence.checked_at' => ['required_if:action,manually_verified', 'date', 'before_or_equal:now'],
            'evidence.findings' => ['required_if:action,manually_verified', 'string', 'max:2000'],
            'evidence.reference' => ['required_if:action,manually_verified', 'string', 'max:300'],
        ]);
        $workflow->decide($document, $request->user(), $data);

        return back()->with('success', 'Review decision recorded.');
    }

    public function queueVerification(Request $request, DriverDocument $document)
    {
        abort_unless($request->user()->hasPermission('verification.run_api'), 403);
        $providers = app(\App\Services\DocumentVerification\DocumentVerifier::class)->catalog();
        $data = $request->validate(['provider' => ['required', Rule::in(array_column($providers[$document->type] ?? [], 'value'))], 'version' => ['required', 'integer']]);
        abort_unless($document->version === (int) $data['version'] && $document->status !== 'approved' && ! $document->expires_at?->lt(today()), 422, 'Reload the current unapproved, unexpired document before requesting verification.');
        $attempt = app(\App\Services\DocumentVerification\DocumentVerifier::class)->reserve($document, $data['provider'], $request->user()->id, (int) $data['version']);
        $job = new \App\Jobs\VerifyDriverDocument($document->id, $document->version, $data['provider'], $request->user()->id);
        $job->requestId = $attempt->request_id;
        dispatch($job);

        return back()->with('success', 'Verification requested. Results are evidence only; human approval is still required.');
    }

    public function analytics(Request $request)
    {
        abort_unless($request->user()->hasPermission('verification.view_audit_logs'), 403);

        return Inertia::render('admin/Verification/Analytics', [
            'providers' => DB::table('document_verification_attempts')->select('provider', 'currency')
                ->selectRaw('COUNT(*) as requests, SUM(CASE WHEN chargeable = 1 THEN 1 ELSE 0 END) as chargeable_requests, SUM(CASE WHEN chargeable IS NULL THEN 1 ELSE 0 END) as unknown_charges, SUM(cost_minor) as known_cost_minor, AVG(duration_ms) as average_ms, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as errors', ['error'])
                ->groupBy('provider', 'currency')->get(),
            'expiring' => DriverDocument::with('driver:id,name')->whereNotNull('expires_at')->where('expires_at', '<=', today()->addDays(30))->orderBy('expires_at')->paginate(30),
        ]);
    }

    public function preview(Request $request, DriverDocumentVersion $version, DocumentWorkflow $workflow)
    {
        $this->authorizeView($request);
        abort_unless($request->hasValidSignature() && (int) $request->query('actor') === $request->user()->id, 403);
        abort_unless($version->storage_disk === 'local' && ! $version->purged_at, 404);
        $document = DriverDocument::findOrFail($version->driver_document_id);
        // Version-specific access event; no raw number or file location in the log.
        $auditDocument = clone $document;
        $auditDocument->version = $version->version;
        $workflow->audit($auditDocument, $request->user(), 'preview', $document->status, 'Viewed private document version.');

        return Storage::disk('local')->response($version->file_path, 'document.'.$this->extension($version->mime_type), [
            'Content-Type' => $version->mime_type, 'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "sandbox; default-src 'none'",
        ]);
    }

    private function extension(string $mime): string
    {
        return match ($mime) {
            'application/pdf' => 'pdf', 'image/png' => 'png', 'image/webp' => 'webp', default => 'jpg'
        };
    }

    public function appeal(Request $request, DriverDocument $document)
    {
        abort_unless($request->user() instanceof Driver && $document->driver_id === $request->user()->id, 404);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        DB::transaction(function () use ($document, $data) {
            Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
            $current = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($current->status, ['rejected', 'correction_required', 'flagged', 'suspended', 'expired'], true), 422, 'This document is not eligible for appeal.');
            DB::table('verification_appeals')->insertOrIgnore([
                'driver_document_id' => $current->id, 'version' => $current->version,
                'reason' => $data['reason'], 'created_at' => now(), 'updated_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'message' => 'Appeal submitted for review.']);
    }

    public function notices(Request $request)
    {
        abort_unless($request->user() instanceof Driver, 403);

        return response()->json(['data' => DB::table('verification_notices')->where('driver_id', $request->user()->id)->latest('id')->paginate(30)]);
    }

    public function readNotice(Request $request, int $notice)
    {
        abort_unless($request->user() instanceof Driver, 403);
        $query = DB::table('verification_notices')->where('driver_id', $request->user()->id)->where('id', $notice);
        abort_unless($query->exists(), 404);
        $query->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function resolveFinding(Request $request, \App\Models\VerificationFinding $finding, DocumentWorkflow $workflow)
    {
        abort_unless($request->user()->hasPermission('verification.resolve_finding'), 403);
        $data = $request->validate(['source' => ['required', 'string', 'max:500'], 'reference' => ['required', 'string', 'max:300'], 'findings' => ['required', 'string', 'max:2000']]);
        DB::transaction(function () use ($request, $finding, $data, $workflow) {
            $document = DriverDocument::findOrFail($finding->driver_document_id);
            Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
            $document = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
            $finding = \App\Models\VerificationFinding::whereKey($finding->id)->lockForUpdate()->firstOrFail();
            abort_if($finding->non_overridable || $finding->resolved_at || $finding->version !== $document->version, 422, 'This finding cannot be overridden. Obtain a corrected document or authoritative replacement evidence.');
            $finding->update(['resolution_evidence' => $data, 'resolved_at' => now(), 'resolved_by' => $request->user()->id]);
            $workflow->audit($document, $request->user(), 'finding_resolved', $document->status, 'Finding resolved with supporting evidence.', ['finding_id' => $finding->id, ...$data]);
        });

        return back()->with('success', 'Finding resolved. A separate verification and approval are still required.');
    }

    public function legalHold(Request $request, DriverDocumentVersion $version, DocumentWorkflow $workflow)
    {
        abort_unless($request->user()->hasPermission('verification.manage_retention'), 403);
        $data = $request->validate(['legal_hold' => ['required', 'boolean'], 'reason' => ['required', 'string', 'max:2000']]);
        DB::transaction(function () use ($request, $version, $data, $workflow) {
            $document = DriverDocument::findOrFail($version->driver_document_id);
            Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
            $current = DriverDocumentVersion::whereKey($version->id)->lockForUpdate()->firstOrFail();
            abort_if($current->purged_at, 422, 'This version has already been purged.');
            DB::table('driver_document_versions')->where('id', $version->id)->update(['legal_hold' => $data['legal_hold']]);
            $document->version = $version->version;
            $workflow->audit($document, $request->user(), 'retention_hold', $document->status, $data['reason'], ['legal_hold' => $data['legal_hold']]);
        });

        return back()->with('success', 'Retention hold updated.');
    }

    public function resolveAppeal(Request $request, int $appeal, DocumentWorkflow $workflow)
    {
        abort_unless($request->user()->hasPermission('verification.resolve_appeal'), 403);
        $data = $request->validate(['resolution' => ['required', 'string', 'max:2000'], 'decision' => ['required', Rule::in(['upheld', 'reopen'])]]);
        $record = DB::table('verification_appeals')->find($appeal);
        abort_unless($record, 404);
        $document = DriverDocument::findOrFail($record->driver_document_id);
        DB::transaction(function () use ($request, $appeal, $document, $data, $workflow) {
            Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
            $current = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
            $record = DB::table('verification_appeals')->where('id', $appeal)->lockForUpdate()->first();
            abort_unless($record->status === 'pending' && $record->version === $current->version, 422, 'This appeal has already been resolved or refers to an older document.');
            if ($data['decision'] === 'reopen') {
                $workflow->decide($current, $request->user(), ['version' => $current->version, 'action' => 'reopen', 'reason' => $data['resolution']]);
            }
            DB::table('verification_appeals')->where('id', $appeal)->update(['status' => $data['decision'], 'resolution' => $data['resolution'], 'resolved_by' => $request->user()->id, 'updated_at' => now()]);
            $workflow->audit($current, $request->user(), 'appeal_resolved', $current->status, $data['resolution']);
            $workflow->notice($current, 'appeal-'.$appeal, 'Your document appeal was reviewed. Outcome: '.$data['decision'].'.');
        });

        return back()->with('success', 'Appeal resolved.');
    }
}

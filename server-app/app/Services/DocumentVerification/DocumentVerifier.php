<?php

namespace App\Services\DocumentVerification;

use App\Models\DocumentVerificationAttempt;
use App\Models\DriverDocument;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DocumentVerifier
{
    public function enabled(string $id): bool
    {
        if ($id === 'eko') {
            return (bool) config('document_verification.eko.enabled') && DB::table('verification_provider_settings')->where('provider', $id)->where('enabled', true)->whereNotNull('authorization_reference')->exists();
        }

        return ! config("document_verification.providers.{$id}.simulated") || app()->environment(['local', 'testing']);
    }

    public function catalog(): array
    {
        return collect(config('document_verification.types', []))->map(fn ($ids) => collect($ids)
            ->filter(fn ($id) => config("document_verification.providers.{$id}") && $this->enabled($id))
            ->map(fn ($id) => ['value' => $id, 'label' => config("document_verification.providers.{$id}.label"),
                'simulated' => (bool) config("document_verification.providers.{$id}.simulated", false)])
            ->values()->all())->all();
    }

    private function fingerprint(DriverDocument $document): string
    {
        return hash('sha256', json_encode([$document->version, $document->file_path, $document->encrypted_number ?: $document->document_number, $document->expires_at?->toDateString(), $document->type, app(\App\Services\Verification\RequirementPolicy::class)->subjectHash($document->driver)]));
    }

    public function reserve(DriverDocument $document, string $provider, int $reviewer, int $version): DocumentVerificationAttempt
    {
        return DB::transaction(function () use ($document, $provider, $reviewer, $version) {
            \App\Models\Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
            $current = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
            if ($current->version !== $version || ! in_array($current->status, ['pending', 'under_review', 'inconclusive', 'api_verified'], true) || $current->expires_at?->lt(today())) {
                throw ValidationException::withMessages(['document' => 'Reload a current document eligible for API verification.']);
            }
            if (! $this->enabled($provider) || ! in_array($provider, config("document_verification.types.{$current->type}", []), true)) {
                throw ValidationException::withMessages(['provider' => 'Provider not supported or authorized.']);
            }
            if ($current->verificationAttempts()->whereIn('status', ['queued', 'processing'])->exists()) {
                throw ValidationException::withMessages(['document' => 'A request is already queued or processing. Reconcile its outcome before requesting another.']);
            }

            return $current->verificationAttempts()->create(['request_id' => (string) Str::uuid(), 'document_fingerprint' => $this->fingerprint($current), 'provider' => $provider, 'simulated' => config("document_verification.providers.{$provider}.simulated", false), 'requested_by' => $reviewer, 'version' => $version, 'status' => 'queued']);
        });
    }

    public function verify(DriverDocument $document, string $provider, int $reviewer, ?string $outcome = null, ?string $requestId = null, ?int $expectedVersion = null): DocumentVerificationAttempt
    {
        $definition = config("document_verification.providers.{$provider}");
        if (! $this->enabled($provider)) {
            throw ValidationException::withMessages(['provider' => 'This provider is not enabled and authorized.']);
        }
        if (($definition['simulated'] ?? false) && ! app()->environment(['local', 'testing'])) {
            throw ValidationException::withMessages(['provider' => 'Simulated providers are disabled outside development.']);
        }
        if (! $definition || ! in_array($provider, config("document_verification.types.{$document->type}", []), true)) {
            throw ValidationException::withMessages(['provider' => 'Choose a supported provider for this document type.']);
        }
        if ($outcome !== null && ! ($definition['simulated'] ?? false)) {
            throw ValidationException::withMessages(['outcome' => 'An outcome can only be selected for a simulation.']);
        }
        $adapter = app($definition['adapter']);
        if (! $adapter instanceof VerificationProvider) {
            throw ValidationException::withMessages(['provider' => 'The verification provider is not configured correctly.']);
        }
        $replayed = false;
        $attempt = DB::transaction(function () use ($document, $provider, $reviewer, $definition, $requestId, $expectedVersion, &$replayed) {
            \App\Models\Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
            $locked = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
            $document->setRawAttributes($locked->getAttributes(), true);
            $document->unsetRelations();
            if ($requestId && ($existing = DocumentVerificationAttempt::where('request_id', $requestId)->first())) {
                if ($existing->driver_document_id !== $document->id || $existing->provider !== $provider || $existing->requested_by !== $reviewer) {
                    throw ValidationException::withMessages(['document' => 'Request identity mismatch.']);
                }
                if ($existing->status === 'queued') {
                    if ($existing->document_fingerprint !== $this->fingerprint($document) || ! in_array($document->status, ['pending', 'under_review', 'inconclusive', 'api_verified'], true)) {
                        $existing->update(['status' => 'superseded', 'message' => 'Queued evidence changed before execution.', 'completed_at' => now()]);
                        $replayed = true;
                    } else {
                        $existing->update(['status' => 'processing']);
                    }
                } else {
                    $replayed = true;
                }

                return $existing;
            }
            if ($expectedVersion !== null && $document->version !== $expectedVersion) {
                throw ValidationException::withMessages(['document' => 'The queued document version has changed.']);
            }
            if ($document->expires_at?->lt(today())) {
                throw ValidationException::withMessages(['document' => 'This document has expired. Upload a valid replacement.']);
            }
            if ($document->status === 'approved') {
                throw ValidationException::withMessages(['document' => 'This document is already approved.']);
            }
            if ($document->verificationAttempts()->where('status', 'processing')->where('created_at', '>', now()->subMinutes(5))->exists()) {
                throw ValidationException::withMessages(['document' => 'Verification is already running.']);
            }

            return $document->verificationAttempts()->create([
                'request_id' => $requestId ?? (string) Str::uuid(), 'document_fingerprint' => $this->fingerprint($document),
                'provider' => $provider, 'simulated' => $definition['simulated'] ?? false, 'requested_by' => $reviewer, 'version' => $document->version,
            ]);
        });

        if ($replayed) {
            return $attempt;
        }

        $startedAt = hrtime(true);
        try {
            $result = $adapter->verify($document, $attempt->request_id, $outcome === null ? [] : ['outcome' => $outcome]);
        } catch (\Throwable $error) {
            // Provider exceptions may contain identifiers or credentials. Persist a sanitized outcome only.
            $result = new VerificationResult('error', $attempt->request_id, 'Provider unavailable. Retry verification.');
        }

        $duration = (int) ((hrtime(true) - $startedAt) / 1000000);

        return DB::transaction(function () use ($document, $attempt, $result, $duration) {
            \App\Models\Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
            $current = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
            $stale = $this->fingerprint($current) !== $attempt->document_fingerprint
                || (int) $current->verificationAttempts()->max('id') !== (int) $attempt->id
                || $current->expires_at?->lt(today())
                || $current->status !== $document->status;
            $attempt->update([
                'status' => $stale ? 'superseded' : $result->status, 'reference' => $result->reference,
                'message' => $stale ? 'Document changed. Run verification on the current upload.' : $result->message,
                'completed_at' => now(),
                'duration_ms' => $duration, 'chargeable' => $result->chargeable,
                'cost_minor' => $result->costMinor, 'currency' => $result->currency,
                'attributes' => $result->attributes, 'error_code' => $result->errorCode,
            ]);
            // Provider output is evidence only. It cannot make an administrative decision.
            // Simulations are never authoritative evidence, even in development.
            if (! $stale) {
                app(\App\Services\Verification\DocumentWorkflow::class)->providerEvidence($current, $attempt, $result);
            }

            return $attempt;
        });
    }
}

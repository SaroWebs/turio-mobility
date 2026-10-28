<?php

namespace App\Jobs;

use App\Models\DriverDocument;
use App\Services\DocumentVerification\DocumentVerifier;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class VerifyDriverDocument implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    // A worker must never automatically repeat a potentially chargeable check.
    public int $tries = 1;

    public int $timeout = 60;

    public int $uniqueFor = 600;

    public string $requestId;

    public function __construct(public int $documentId, public int $version, public string $provider, public int $reviewerId, public ?string $outcome = null)
    {
        $this->requestId = (string) \Illuminate\Support\Str::uuid();
    }

    public function uniqueId(): string
    {
        return 'driver-document:'.$this->documentId.':'.$this->version;
    }

    public function handle(DocumentVerifier $verifier): void
    {
        $document = DriverDocument::find($this->documentId);
        if (! $document || $document->version !== $this->version || $document->status === 'approved') {
            $this->cancel('Document changed before queued verification.');

            return;
        }
        $reviewer = \App\Models\User::find($this->reviewerId);
        if (! $reviewer?->hasPermission('verification.run_api')) {
            $this->cancel('Reviewer no longer has verification permission.');

            return;
        }
        $verifier->verify($document, $this->provider, $this->reviewerId, $this->outcome, $this->requestId, $this->version);
    }

    private function cancel(string $message): void
    {
        \App\Models\DocumentVerificationAttempt::where('request_id', $this->requestId)->where('status', 'queued')->update(['status' => 'superseded', 'message' => $message, 'completed_at' => now()]);
    }

    public function failed(?\Throwable $exception): void
    {
        \App\Models\DocumentVerificationAttempt::where('request_id', $this->requestId)->whereIn('status', ['queued', 'processing'])->update(['status' => 'error', 'error_code' => 'worker_failed', 'message' => 'Worker failed. Provider outcome and billing may be unknown; reconcile before requesting another check.', 'completed_at' => now()]);
    }
}

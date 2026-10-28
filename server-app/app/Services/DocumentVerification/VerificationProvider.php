<?php

namespace App\Services\DocumentVerification;

use App\Models\DriverDocument;

interface VerificationProvider
{
    // Adapters must use requestId as the external idempotency key and enforce
    // timeouts. Credentials belong in server configuration, never the request.
    public function verify(DriverDocument $document, string $requestId, array $options = []): VerificationResult;
}

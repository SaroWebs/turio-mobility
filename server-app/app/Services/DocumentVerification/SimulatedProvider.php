<?php

namespace App\Services\DocumentVerification;

use App\Models\DriverDocument;

class SimulatedProvider implements VerificationProvider
{
    public function verify(DriverDocument $document, string $requestId, array $options = []): VerificationResult
    {
        $outcome = $options['outcome'] ?? 'approved';

        return new VerificationResult($outcome, 'SIM-'.$requestId, match ($outcome) {
            'approved' => 'Simulated verification passed. No external registry was contacted.',
            'rejected' => 'Simulated provider rejected the document. Upload a valid replacement.',
            default => 'Simulated provider unavailable. Retry verification.',
        }, false, 0, 'INR');
    }
}

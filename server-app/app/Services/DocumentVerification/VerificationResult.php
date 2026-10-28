<?php

namespace App\Services\DocumentVerification;

final readonly class VerificationResult
{
    public function __construct(
        public string $status,
        public string $reference,
        public string $message,
        public ?bool $chargeable = null,
        public ?int $costMinor = null,
        public ?string $currency = null,
        public array $attributes = [],
        public ?string $errorCode = null,
    ) {
        if (! in_array($status, ['approved', 'rejected', 'error', 'inconclusive'], true)) {
            throw new \InvalidArgumentException('Unsupported verification result.');
        }
    }
}

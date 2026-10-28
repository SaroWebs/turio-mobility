<?php

namespace App\Services\Security;

/**
 * Immutable outcome of a malware scan (SKY-MRD-001 §12.1). Three states:
 *  - clean:    no signature matched; the file is safe to store.
 *  - infected: a signature matched; {@see $signature} names it.
 *  - error:    the scan could not be completed (scanner unreachable/timed out).
 *              Callers apply the `antivirus.fail_closed` policy to decide whether
 *              an errored scan blocks the upload.
 */
class ScanResult
{
    private function __construct(
        public readonly string $status,
        public readonly ?string $signature = null,
        public readonly ?string $detail = null,
    ) {}

    public static function clean(): self
    {
        return new self('clean');
    }

    public static function infected(string $signature): self
    {
        return new self('infected', $signature);
    }

    public static function error(string $detail): self
    {
        return new self('error', null, $detail);
    }

    public function isClean(): bool
    {
        return $this->status === 'clean';
    }

    public function isInfected(): bool
    {
        return $this->status === 'infected';
    }

    public function isError(): bool
    {
        return $this->status === 'error';
    }
}

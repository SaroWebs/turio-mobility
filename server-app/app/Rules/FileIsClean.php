<?php

namespace App\Rules;

use App\Services\Security\MalwareScanner;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

/**
 * Rejects an uploaded file that fails a malware scan (SKY-MRD-001 §12.1).
 *
 * Runs synchronously during validation — before the file is stored — so infected
 * content is never written to disk or served. A scan that cannot be completed
 * (scanner unreachable) blocks the upload when `antivirus.fail_closed` is true
 * (the secure default) and passes otherwise.
 */
class FileIsClean implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // Only inspect real uploads; the file/image/mimes rules handle the rest.
        if (! $value instanceof UploadedFile || ! $value->isValid()) {
            return;
        }

        $result = app(MalwareScanner::class)->scanFile($value->getRealPath());

        if ($result->isInfected()) {
            Log::warning('Rejected an infected upload.', [
                'attribute' => $attribute,
                'file' => $this->maskName($value->getClientOriginalName()),
                'signature' => $result->signature,
            ]);

            $fail('The :attribute failed a security scan and was rejected.');

            return;
        }

        if ($result->isError() && (bool) config('services.antivirus.fail_closed', true)) {
            Log::warning('Blocked an upload that could not be security-scanned.', [
                'attribute' => $attribute,
                'file' => $this->maskName($value->getClientOriginalName()),
            ]);

            $fail('The :attribute could not be security-scanned right now. Please try again later.');
        }
    }

    /** Never log a raw filename; keep only a stable hash prefix and the extension. */
    private function maskName(?string $name): string
    {
        $name = (string) $name;
        if ($name === '') {
            return '****';
        }

        $ext = pathinfo($name, PATHINFO_EXTENSION);

        return substr(hash('sha256', $name), 0, 8).($ext !== '' ? '.'.$ext : '');
    }
}

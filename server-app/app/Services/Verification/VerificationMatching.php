<?php

namespace App\Services\Verification;

use App\Models\DriverDocument;
use App\Models\VerificationFinding;
use Carbon\Carbon;

class VerificationMatching
{
    private function normalized(string $value): string
    {
        return preg_replace('/[^\pL\pN]/u', '', mb_strtolower($value));
    }

    public function findings(DriverDocument $document, array $attributes): array
    {
        $findings = [];
        $add = function (string $code, string $message, bool $hard = false, string $severity = 'critical', bool $blocking = true) use (&$findings) {
            $findings[] = ['code' => $code, 'message' => $message, 'non_overridable' => $hard, 'severity' => $severity, 'blocking' => $blocking];
        };
        $driver = $document->driver;
        if (isset($attributes['name']) && $this->normalized($attributes['name']) !== $this->normalized($driver->name)) {
            $add('name_mismatch', 'Verified name differs from the driver profile. Obtain independent identity evidence.', false, 'warning');
        } elseif (isset($attributes['name']) && $attributes['name'] !== $driver->name) {
            $add('name_format', 'Only name formatting differs.', false, 'info', false);
        }
        if (isset($attributes['dob']) && $driver->date_of_birth && $attributes['dob'] !== $driver->date_of_birth->toDateString()) {
            $add('dob_mismatch', 'Verified birth date differs from the driver profile.');
        }
        foreach ($driver->documents()->where('id', '!=', $document->id)->where('verification_outcome', 'verified')->get() as $other) {
            $evidence = $other->verificationAttempts()->where('version', $other->version)->where('simulated', false)->where('status', 'approved')->first()?->attributes ?? [];
            foreach (['name', 'dob'] as $field) {
                if (isset($attributes[$field], $evidence[$field]) && $this->normalized($attributes[$field]) !== $this->normalized($evidence[$field])) {
                    $add('cross_document_'.$field, 'Verified '.$field.' differs between current documents. Independent identity evidence is required.', false, 'warning');
                }
            }
        }
        if (isset($attributes['valid']) && $attributes['valid'] === false) {
            $add('invalid_registry_status', 'The authoritative source reports an invalid, suspended or expired document.', true);
        }
        $number = $document->encrypted_number ?: $document->document_number;
        if ($number && isset($attributes['document_number']) && $this->normalized($number) !== $this->normalized($attributes['document_number'])) {
            $add('number_mismatch', 'The source returned a different document number.', true);
        }
        foreach (['expires_at'] as $field) {
            if (! empty($attributes[$field]) && Carbon::parse($attributes[$field])->lt(today())) {
                $add('expired_'.$field, 'Authoritative document validity has expired.', true);
            }
        }
        if ($document->type === 'vehicle_rc') {
            $vehicle = $driver->vehicle;
            if (! $vehicle || ! isset($attributes['document_number']) || $this->normalized($vehicle->registration_number) !== $this->normalized($attributes['document_number'])) {
                $add('vehicle_mismatch', 'RC does not match the registered vehicle.', true);
            }
            if (isset($attributes['owner']) && $this->normalized($attributes['owner']) !== $this->normalized($driver->name)) {
                $add('owner_authorization', 'Registered owner differs; verify permission from the owner.', false, 'warning');
            }
        }
        foreach (['registration_number', 'make', 'model'] as $field) {
            if (isset($attributes[$field]) && $driver->vehicle && $this->normalized($attributes[$field]) !== $this->normalized((string) $driver->vehicle->{$field})) {
                $add('vehicle_'.$field, 'Verified vehicle '.$field.' differs from the registered vehicle.', $field === 'registration_number');
            }
        }
        if ($document->type === 'driving_license') {
            foreach (app(RequirementPolicy::class)->forDocument($document) as $requirement) {
                if ($requirement->licence_class && ! in_array($requirement->licence_class, $attributes['vehicle_classes'] ?? [], true)) {
                    $add('licence_class', 'The required vehicle class was not established by this source. Record independent authoritative evidence.');
                }
                if ($requirement->licence_scope) {
                    $until = $attributes[$requirement->licence_scope.'_valid_until'] ?? null;
                    if (! $until || Carbon::parse($until)->lt(today())) {
                        $add('licence_scope', 'The required transport/non-transport validity was not established.', (bool) $until);
                    }
                }
            }
        }

        return $findings;
    }

    public function record(DriverDocument $document, array $attributes, ?int $attemptId): array
    {
        $findings = $this->findings($document, $attributes);
        foreach ($findings as $finding) {
            VerificationFinding::create([...$finding, 'driver_document_id' => $document->id, 'version' => $document->version, 'attempt_id' => $attemptId, 'created_at' => now()]);
        }

        return $findings;
    }

    public function blocked(DriverDocument $document): bool
    {
        return VerificationFinding::where('driver_document_id', $document->id)->where('version', $document->version)->where('blocking', true)->whereNull('resolved_at')->exists();
    }
}

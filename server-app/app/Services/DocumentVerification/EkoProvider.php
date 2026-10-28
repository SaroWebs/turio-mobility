<?php

namespace App\Services\DocumentVerification;

use App\Models\DriverDocument;
use Illuminate\Support\Facades\Http;

/** Eko EPS v3: documented synchronous DL/RC APIs. Never retries chargeable calls. */
class EkoProvider implements VerificationProvider
{
    public static function signature(string $accessKey, string $timestamp): string
    {
        return base64_encode(hash_hmac('sha256', $timestamp, base64_encode($accessKey), true));
    }

    public function verify(DriverDocument $document, string $requestId, array $options = []): VerificationResult
    {
        $config = config('document_verification.eko');
        if (! $config['enabled'] || ! $config['developer_key'] || ! $config['access_key'] || ! $config['initiator_id']) {
            return new VerificationResult('error', $requestId, 'Eko credentials and authorization must be configured.', errorCode: 'not_configured');
        }
        $number = $document->encrypted_number ?: $document->document_number;
        if (! $number || ! in_array($document->type, ['driving_license', 'vehicle_rc'], true)) {
            return new VerificationResult('inconclusive', $requestId, 'This check requires a supported document and identifier.', errorCode: 'unsupported_input');
        }
        $payload = ['initiator_id' => $config['initiator_id'], 'client_ref_id' => substr(str_replace('-', '', $requestId), 0, 20)];
        if ($document->type === 'driving_license') {
            $dob = $document->driver->date_of_birth?->toDateString();
            if (! $dob) {
                return new VerificationResult('inconclusive', $requestId, 'Record the driver birth date before checking the licence.', errorCode: 'missing_dob');
            }
            $payload += ['dl_number' => $number, 'dob' => $dob];
            $path = '/tools/kyc/driving-license';
        } else {
            $payload += ['vehicle_number' => $number];
            $path = '/tools/kyc/vehicle-rc';
        }
        $base = $config['production'] ? 'https://api.eko.in/ekoicici/v3' : 'https://staging.eko.in/ekoapi/v3';
        $timestamp = (string) (int) floor(microtime(true) * 1000);
        try {
            $response = Http::withHeaders(['developer_key' => $config['developer_key'], 'secret-key' => self::signature($config['access_key'], $timestamp), 'secret-key-timestamp' => $timestamp])
                ->acceptJson()->connectTimeout(5)->timeout(25)->withoutRedirecting()->post($base.$path, $payload);
        } catch (\Illuminate\Http\Client\ConnectionException) {
            return new VerificationResult('error', $requestId, 'Provider did not respond. Billing outcome is unknown; review before retrying.', errorCode: 'timeout');
        }
        if (! $response->successful()) {
            return new VerificationResult('error', $requestId, 'Provider request could not be completed.', errorCode: 'http_'.$response->status());
        }
        $body = $response->json();
        if (! is_array($body) || ($body['status'] ?? null) !== 0 || ! is_array($body['data'] ?? null)) {
            return new VerificationResult('inconclusive', $requestId, 'Provider did not establish validity. Independent review is required.', errorCode: 'unconfirmed_response');
        }
        $data = $body['data'];
        if ($document->type === 'driving_license') {
            $attributes = [
                'document_number' => $data['dl_number'] ?? null, 'name' => data_get($data, 'details_of_driving_licence.name'),
                'dob' => $data['dob'] ?? null, 'registry_status' => $data['status'] ?? null,
                'vehicle_classes' => collect(data_get($data, 'details_of_driving_licence.cov_details', []))->pluck('cov')->filter()->values()->all(),
                'transport_valid_until' => data_get($data, 'dl_validity.transport.to'),
                'non_transport_valid_until' => data_get($data, 'dl_validity.non_transport.to'),
            ];
        } else {
            $attributes = ['document_number' => $data['reg_no'] ?? null, 'owner' => $data['owner'] ?? null,
                'registry_status' => $data['rc_status'] ?? null, 'expires_at' => $data['rc_expiry_date'] ?? null];
        }
        foreach ($attributes as $key => $value) {
            if ($value === null) {
                unset($attributes[$key]);

                continue;
            }
            if ($key !== 'vehicle_classes' && ! is_string($value)) {
                return new VerificationResult('inconclusive', $requestId, 'Provider response has unexpected attribute types.', errorCode: 'invalid_schema');
            }
            if ($key === 'vehicle_classes' && collect($value)->contains(fn ($class) => ! is_string($class))) {
                return new VerificationResult('inconclusive', $requestId, 'Provider licence classes could not be interpreted.', errorCode: 'invalid_schema');
            }
            if (str_ends_with($key, '_until') || in_array($key, ['expires_at', 'dob'], true)) {
                $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
                if (! $date || $date->format('Y-m-d') !== $value) {
                    return new VerificationResult('inconclusive', $requestId, 'Provider date could not be interpreted safely.', errorCode: 'invalid_date');
                }
            }
        }
        $status = strtolower($attributes['registry_status'] ?? '');
        $attributes['valid'] = $status === 'active' ? true : (in_array($status, ['expired', 'suspended', 'cancelled', 'inactive'], true) ? false : null);
        $complete = isset($attributes['document_number']) && ($document->type === 'vehicle_rc' ? isset($attributes['owner']) : isset($attributes['name'], $attributes['dob']));

        return new VerificationResult($complete && $attributes['valid'] === true ? 'approved' : 'inconclusive', $requestId,
            'Registry evidence received. Review attribute matches before an administrative decision.',
            chargeable: $document->type === 'vehicle_rc' ? true : null, attributes: $attributes);
    }
}

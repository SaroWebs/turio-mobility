<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Context;

/**
 * Builds the strict v1 API envelope (SKY-MRD-001 §9.1–9.2).
 *
 * Use only for NEW /api/v1 endpoints. Legacy endpoints keep their existing
 * top-level shape (frozen mobile clients + customer-web depend on it) and
 * merely receive an additive `meta` block via EnsureResponseMeta — they must
 * not be rewritten onto this envelope.
 */
class ApiResponse
{
    /**
     * Success envelope: {success:true, data, meta}.
     */
    public static function success(mixed $data = null, array $meta = [], int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => self::meta($meta),
        ], $status);
    }

    /**
     * Error envelope: {success:false, error:{code,message,fields?}, meta}.
     *
     * @param  array<string, array<int, string>|string>  $fields  per-field messages
     */
    public static function error(string $code, string $message, array $fields = [], int $status = 400, array $meta = []): JsonResponse
    {
        $error = [
            'code' => $code,
            'message' => $message,
        ];

        if ($fields !== []) {
            $error['fields'] = $fields;
        }

        return response()->json([
            'success' => false,
            'error' => $error,
            'meta' => self::meta($meta),
        ], $status);
    }

    /**
     * The standard meta block: the current request id (for support/tracing) and
     * the contract version. Callers may merge in extra keys.
     *
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    public static function meta(array $extra = []): array
    {
        return array_merge([
            'request_id' => Context::get('request_id'),
            'contract_version' => config('contract.version'),
        ], $extra);
    }
}

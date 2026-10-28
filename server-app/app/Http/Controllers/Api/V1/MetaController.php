<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Public v1 discovery endpoint. Advertises the current contract version and
 * server time so a client can negotiate/verify the contract it is coding to
 * (SKY-MRD-001 §9.3). Also the canonical example of the success envelope.
 */
class MetaController extends Controller
{
    public function show(): JsonResponse
    {
        return ApiResponse::success([
            'contract_version' => config('contract.version'),
            'server_time' => now()->toIso8601String(),
        ]);
    }
}

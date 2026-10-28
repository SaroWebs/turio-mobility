<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Adds an additive `meta` block ({request_id, contract_version}) to JSON API
 * responses (SKY-MRD-001 §9.1). Deliberately conservative for backward
 * compatibility with the frozen mobile clients and customer-web:
 *
 *  - only object-shaped (associative) JSON bodies are touched; JSON arrays/lists
 *    and non-JSON/streamed/binary responses pass through untouched;
 *  - no existing key is altered, reordered, or removed — `meta` is merged in and
 *    keys the endpoint already set inside `meta` win.
 *
 * New /api/v1 endpoints build the full envelope via App\Support\ApiResponse;
 * this middleware guarantees the meta block exists even on legacy responses.
 */
class EnsureResponseMeta
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $this->isDecorable($response)) {
            return $response;
        }

        $payload = $this->decode($response);

        // Only decorate object-shaped bodies; skip JSON lists and empty bodies.
        if ($payload === null || $payload === [] || array_is_list($payload)) {
            return $response;
        }

        $meta = (isset($payload['meta']) && is_array($payload['meta'])) ? $payload['meta'] : [];

        // Union preserves any keys the endpoint already placed under meta.
        $meta += [
            'request_id' => Context::get('request_id'),
            'contract_version' => config('contract.version'),
        ];

        $payload['meta'] = $meta;

        $this->write($response, $payload);

        return $response;
    }

    private function isDecorable(Response $response): bool
    {
        if ($response instanceof StreamedResponse || $response instanceof BinaryFileResponse) {
            return false;
        }

        if ($response instanceof JsonResponse) {
            return true;
        }

        return str_contains((string) $response->headers->get('Content-Type'), 'application/json');
    }

    /**
     * @return array<mixed>|null
     */
    private function decode(Response $response): ?array
    {
        if ($response instanceof JsonResponse) {
            $data = $response->getData(true);

            return is_array($data) ? $data : null;
        }

        $content = $response->getContent();
        if ($content === false || $content === '') {
            return null;
        }

        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param  array<mixed>  $payload
     */
    private function write(Response $response, array $payload): void
    {
        if ($response instanceof JsonResponse) {
            $response->setData($payload);

            return;
        }

        $response->setContent(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }
}

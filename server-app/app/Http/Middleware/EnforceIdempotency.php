<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyKey;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stripe-style idempotency for mutating endpoints (SKY-MRD-001 invariant #1,
 * FR-BOOK-01). When a client sends an `Idempotency-Key` header, the first
 * request claims the key and its response is stored; a retry with the same key
 * replays the stored response instead of repeating the side effect.
 *
 * Graceful by design: the frozen mobile clients (customer-mobile-app /
 * driver-app) do not send the header and must keep working, so a request
 * without a key simply passes through unmodified. Clients that DO send a key
 * (customer-web, updated apps) get exactly-once semantics.
 */
class EnforceIdempotency
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = trim((string) $request->header('Idempotency-Key'));

        // No key → nothing to enforce (protects frozen clients that omit it).
        if ($key === '') {
            return $next($request);
        }

        $scope = $this->scopeFor($request);
        $hash = hash('sha256', $request->getContent());

        // Try to claim the key atomically. The unique(scope, key) index makes
        // this the concurrency guard: exactly one racing request wins the insert.
        try {
            $record = IdempotencyKey::create([
                'scope' => $scope,
                'idempotency_key' => $key,
                'method' => $request->getMethod(),
                'path' => $request->path(),
                'request_hash' => $hash,
                'status' => IdempotencyKey::STATUS_PROCESSING,
            ]);
        } catch (QueryException $e) {
            if (! $this->isUniqueViolation($e)) {
                throw $e;
            }

            return $this->handleExisting($scope, $key, $hash, $next, $request);
        }

        // We own the key: run the request, then persist its outcome for replay.
        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            // Transient failure — release the key so the client may retry.
            $record->delete();
            throw $e;
        }

        $this->persistOrRelease($record, $response);

        return $response;
    }

    /** Resolve a replay/conflict decision for a key that already exists. */
    private function handleExisting(string $scope, string $key, string $hash, Closure $next, Request $request): Response
    {
        $existing = IdempotencyKey::where('scope', $scope)
            ->where('idempotency_key', $key)
            ->first();

        // Row vanished between the failed insert and this read (rare); retry the
        // request without idempotency rather than erroring the caller.
        if (! $existing) {
            return $next($request);
        }

        // Same key, different payload → the client is misusing the key.
        if (! hash_equals($existing->request_hash, $hash)) {
            return response()->json([
                'success' => false,
                'message' => 'Idempotency-Key was already used with a different request.',
            ], 422);
        }

        if ($existing->isCompleted()) {
            return $this->replay($existing);
        }

        // Original request is still in flight.
        return response()->json([
            'success' => false,
            'message' => 'A request with this Idempotency-Key is still being processed.',
        ], 409);
    }

    /**
     * Cache deterministic outcomes (2xx/4xx) for replay; release the key on
     * server errors (5xx) so the client can safely retry the operation.
     */
    private function persistOrRelease(IdempotencyKey $record, Response $response): void
    {
        if ($response->getStatusCode() >= 500) {
            $record->delete();

            return;
        }

        $record->update([
            'status' => IdempotencyKey::STATUS_COMPLETED,
            'response_status' => $response->getStatusCode(),
            'response_body' => $response->getContent(),
            'response_headers' => ['Content-Type' => $response->headers->get('Content-Type')],
        ]);
    }

    private function replay(IdempotencyKey $record): Response
    {
        $response = response($record->response_body ?? '', $record->response_status ?? 200);

        $contentType = $record->response_headers['Content-Type'] ?? 'application/json';
        $response->headers->set('Content-Type', $contentType);
        $response->headers->set('Idempotent-Replayed', 'true');

        return $response;
    }

    private function scopeFor(Request $request): string
    {
        $user = $request->user();

        return $user
            ? $user::class.':'.$user->getAuthIdentifier()
            : 'anon:'.$request->ip();
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        // SQLSTATE 23000 (integrity constraint) covers unique violations across
        // MySQL/Postgres/SQLite; the driver code 1555/2067/19 are SQLite unique.
        $sqlState = $e->errorInfo[0] ?? null;

        return $sqlState === '23000' || $sqlState === '23505'
            || str_contains(strtolower($e->getMessage()), 'unique');
    }
}

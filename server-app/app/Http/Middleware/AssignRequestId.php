<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Assigns a request/correlation id to every request and propagates it into the
 * logging Context and the response headers (SKY-MRD-001 §13.2 observability).
 *
 * A client (or upstream gateway) may supply its own id via `X-Request-Id` or
 * `X-Correlation-Id`; we accept it only if it looks sane, otherwise we mint a
 * fresh `req_`+uuid. The value is stored on Laravel's Context so every log line
 * written during the request carries it (see App\Logging\InjectRequestContext),
 * and echoed back on `X-Request-Id` so a caller can quote it in a bug report.
 *
 * `correlation_id` tracks a logical operation that may span several requests: it
 * defaults to the inbound X-Correlation-Id, else the request id.
 */
class AssignRequestId
{
    /** Max length we accept for a client-supplied id; longer/garbage → regenerate. */
    private const MAX_ID_LENGTH = 128;

    public function handle(Request $request, Closure $next): Response
    {
        $requestId = $this->sanitize($request->header('X-Request-Id'))
            ?? 'req_'.Str::uuid()->toString();

        $correlationId = $this->sanitize($request->header('X-Correlation-Id'))
            ?? $requestId;

        Context::add('request_id', $requestId);
        Context::add('correlation_id', $correlationId);

        $response = $next($request);

        // Auth resolves during the route stack (after this middleware runs), so
        // capture the actor now for any terminating/observer log lines.
        if ($actor = $this->actorFor($request)) {
            Context::add('actor', $actor);
        }

        $response->headers->set('X-Request-Id', $requestId);
        $response->headers->set('X-Correlation-Id', $correlationId);

        return $response;
    }

    /**
     * Accept a client-supplied id only when it is a short, safe token. Anything
     * with control characters, whitespace, or excessive length is rejected so a
     * header can't be used to inject into logs or bloat storage.
     */
    private function sanitize(?string $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '' || strlen($value) > self::MAX_ID_LENGTH) {
            return null;
        }

        return preg_match('/^[A-Za-z0-9._\-]+$/', $value) === 1 ? $value : null;
    }

    private function actorFor(Request $request): ?string
    {
        $user = $request->user();

        return $user ? $user::class.':'.$user->getAuthIdentifier() : null;
    }
}

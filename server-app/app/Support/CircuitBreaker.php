<?php

namespace App\Support;

use App\Exceptions\CircuitOpenException;
use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * A small cache-backed circuit breaker for outbound provider calls
 * (SKY-MRD-001 §13.3). After `failureThreshold` consecutive failures the
 * breaker opens for `cooldownSeconds`; while open, `run()` short-circuits —
 * calling the optional fallback, or throwing {@see CircuitOpenException} — so
 * we stop hammering a provider that is already down. Once the cooldown lapses
 * the next call is allowed through (half-open): success closes the breaker,
 * another failure re-opens it.
 *
 * State lives in the shared cache so it is honoured across request workers and
 * queue workers, not just within one process.
 */
class CircuitBreaker
{
    public function __construct(
        protected string $service,
        protected int $failureThreshold = 5,
        protected int $cooldownSeconds = 60,
    ) {}

    /**
     * Build a breaker for a named service using config/resilience.php defaults.
     */
    public static function for(string $service): self
    {
        $config = config("resilience.circuit_breaker.{$service}", []);
        $default = config('resilience.circuit_breaker.default', []);

        return new self(
            $service,
            (int) ($config['failure_threshold'] ?? $default['failure_threshold'] ?? 5),
            (int) ($config['cooldown_seconds'] ?? $default['cooldown_seconds'] ?? 60),
        );
    }

    public function isOpen(): bool
    {
        return Cache::get($this->openKey()) !== null;
    }

    /**
     * Run $operation under the breaker.
     *
     * - Open circuit: run $fallback if given, else throw CircuitOpenException
     *   (the operation is never invoked).
     * - Closed circuit: a thrown Throwable counts as a failure (and may open
     *   the breaker); on failure $fallback runs if given, else the original
     *   throwable propagates. Success resets the failure count.
     *
     * @template T
     *
     * @param  Closure():T  $operation
     * @param  (Closure(Throwable|null):T)|null  $fallback
     * @return T
     */
    public function run(Closure $operation, ?Closure $fallback = null)
    {
        if ($this->isOpen()) {
            Log::warning('Circuit breaker open; short-circuiting call', ['service' => $this->service]);

            if ($fallback !== null) {
                return $fallback(null);
            }

            throw new CircuitOpenException("Circuit breaker is open for [{$this->service}].");
        }

        try {
            $result = $operation();
            $this->recordSuccess();

            return $result;
        } catch (Throwable $e) {
            $this->recordFailure($e);

            if ($fallback !== null) {
                return $fallback($e);
            }

            throw $e;
        }
    }

    protected function recordSuccess(): void
    {
        Cache::forget($this->failuresKey());
        Cache::forget($this->openKey());
    }

    protected function recordFailure(Throwable $e): void
    {
        // Keep the failure counter alive a little past the cooldown so a slow
        // trickle of failures still converges on opening the breaker.
        $failures = (int) Cache::get($this->failuresKey(), 0) + 1;
        Cache::put($this->failuresKey(), $failures, now()->addSeconds(max($this->cooldownSeconds * 2, 60)));

        if ($failures >= $this->failureThreshold) {
            Cache::put($this->openKey(), true, now()->addSeconds($this->cooldownSeconds));
            Log::error('Circuit breaker opened', [
                'service' => $this->service,
                'failures' => $failures,
                'cooldown_seconds' => $this->cooldownSeconds,
                'reason' => $e->getMessage(),
            ]);
        }
    }

    protected function failuresKey(): string
    {
        return "circuit_breaker:{$this->service}:failures";
    }

    protected function openKey(): string
    {
        return "circuit_breaker:{$this->service}:open";
    }
}

<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown by {@see \App\Support\CircuitBreaker} when a breaker is open and the
 * call is short-circuited without a fallback. Signals "provider is presumed
 * down, we did not even try" — distinct from a real provider error.
 */
class CircuitOpenException extends RuntimeException {}

<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised inside a provider call when the provider itself looks unhealthy — a
 * connection failure or a 5xx response. This is the failure signal the circuit
 * breaker counts toward tripping; client errors (4xx) are deliberately NOT
 * this exception, so a bad request never opens the breaker.
 */
class ProviderUnavailableException extends RuntimeException {}

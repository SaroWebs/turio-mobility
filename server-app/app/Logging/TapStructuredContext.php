<?php

namespace App\Logging;

use Illuminate\Log\Logger;
use Monolog\Logger as Monolog;

/**
 * Log tap that attaches the structured-context processors to a channel
 * (SKY-MRD-001 §13.2). Wire it onto a channel via its `tap` config key.
 *
 * - InjectRequestContext runs everywhere so request/correlation ids appear in
 *   dev and prod logs alike.
 * - RedactSensitiveData runs only outside local/testing, keeping local logs
 *   (including the dev mock-OTP line) readable while guaranteeing production
 *   logs carry no secrets or raw PII.
 */
class TapStructuredContext
{
    public function __invoke(Logger $logger): void
    {
        $monolog = $logger->getLogger();

        if (! $monolog instanceof Monolog) {
            return;
        }

        $monolog->pushProcessor(new InjectRequestContext);

        if (! app()->environment('local', 'testing')) {
            $monolog->pushProcessor(new RedactSensitiveData);
        }
    }
}

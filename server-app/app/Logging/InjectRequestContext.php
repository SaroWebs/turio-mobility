<?php

namespace App\Logging;

use Illuminate\Support\Facades\Context;
use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;

/**
 * Monolog processor that stamps the request/correlation ids (and actor, when
 * known) onto every log record's `extra` bag, so log lines can be grouped by
 * request across services (SKY-MRD-001 §13.2). Values come from Laravel's
 * Context, populated by App\Http\Middleware\AssignRequestId.
 */
class InjectRequestContext implements ProcessorInterface
{
    public function __invoke(LogRecord $record): LogRecord
    {
        try {
            $fields = array_filter([
                'request_id' => Context::get('request_id'),
                'correlation_id' => Context::get('correlation_id'),
                'actor' => Context::get('actor'),
            ], static fn ($value) => $value !== null && $value !== '');
        } catch (\Throwable) {
            // Logging must never fail because Context isn't available yet
            // (e.g. a very early boot log before facades are ready).
            return $record;
        }

        if ($fields === []) {
            return $record;
        }

        $record->extra = array_merge($record->extra, $fields);

        return $record;
    }
}

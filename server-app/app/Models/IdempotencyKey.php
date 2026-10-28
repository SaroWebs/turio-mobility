<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A recorded idempotency key (SKY-MRD-001 invariant #1). The first request for
 * a given (scope, idempotency_key) claims the row (status=processing) and, once
 * handled, stores the response so later retries replay it verbatim.
 */
class IdempotencyKey extends Model
{
    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'scope',
        'idempotency_key',
        'method',
        'path',
        'request_hash',
        'response_status',
        'response_body',
        'response_headers',
        'status',
    ];

    protected $casts = [
        'response_status' => 'integer',
        'response_headers' => 'array',
    ];

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }
}

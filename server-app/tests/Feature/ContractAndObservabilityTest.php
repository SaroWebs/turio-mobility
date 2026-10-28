<?php

use App\Http\Middleware\EnsureResponseMeta;
use App\Logging\RedactSensitiveData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;

/**
 * Response-contract (#13, SKY-MRD-001 §9) and observability (#14, §13.2)
 * regressions.
 *
 *  - the strict v1 envelope ({success, data, meta}) on a real /api/v1 endpoint,
 *  - the additive meta block EnsureResponseMeta merges onto legacy object bodies
 *    without disturbing lists or endpoint-set keys,
 *  - request/correlation-id minting, client propagation, and response echo,
 *  - the log redactor scrubbing secrets and masking PII (incl. nested context).
 */

// ---- #13 response contract --------------------------------------------------

it('returns the strict success envelope on the v1 meta endpoint', function () {
    $version = config('contract.version');

    $response = $this->getJson('/api/v1/meta');

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.contract_version', $version)
        ->assertJsonPath('meta.contract_version', $version);

    // request_id is minted per request; assert it is present and non-empty
    // rather than a fixed value.
    expect($response->json('data.server_time'))->toBeString()
        ->and($response->json('meta.request_id'))->toBeString()->not->toBe('');
});

it('merges an additive meta block onto a legacy object body but leaves lists alone', function () {
    Context::add('request_id', 'req_unit_meta');
    $middleware = new EnsureResponseMeta;
    $request = Request::create('/legacy', 'GET');

    // Object-shaped legacy body → meta is merged in, existing keys untouched.
    $object = $middleware->handle($request, fn () => new JsonResponse(['ride' => ['id' => 7]]));
    $body = $object->getData(true);
    expect($body['ride']['id'])->toBe(7)
        ->and($body['meta']['request_id'])->toBe('req_unit_meta')
        ->and($body['meta']['contract_version'])->toBe(config('contract.version'));

    // A JSON list is passed through verbatim (would break clients if wrapped).
    $list = $middleware->handle($request, fn () => new JsonResponse([1, 2, 3]));
    expect($list->getData(true))->toBe([1, 2, 3]);

    // A meta key the endpoint already set wins over the injected defaults.
    $withMeta = $middleware->handle($request, fn () => new JsonResponse(['data' => [], 'meta' => ['page' => 2]]));
    $decorated = $withMeta->getData(true);
    expect($decorated['meta']['page'])->toBe(2)
        ->and($decorated['meta']['request_id'])->toBe('req_unit_meta');
});

// ---- #14 correlation ids + structured logging -------------------------------

it('echoes a minted request id and honours a sane client-supplied one', function () {
    // No inbound id → the server mints one and echoes it on the response.
    $minted = $this->getJson('/api/v1/meta');
    expect($minted->headers->get('X-Request-Id'))->toBeString()->not->toBe('');

    // A safe client id is accepted and propagated to the header AND meta block.
    $clientId = 'req-client-abc-123';
    $propagated = $this->withHeaders(['X-Request-Id' => $clientId])->getJson('/api/v1/meta');
    $propagated->assertHeader('X-Request-Id', $clientId)
        ->assertJsonPath('meta.request_id', $clientId);
});

it('rejects an unsafe client-supplied request id and mints a fresh one instead', function () {
    // Whitespace/control characters must not be reflected into logs or headers.
    $response = $this->withHeaders(['X-Request-Id' => "bad id\nwith space"])->getJson('/api/v1/meta');

    $echoed = $response->headers->get('X-Request-Id');
    expect($echoed)->not->toBe("bad id\nwith space")
        ->and($echoed)->toStartWith('req_'); // minted fallback
});

it('scrubs secrets and masks PII in log context, recursing into nested arrays', function () {
    $scrubbed = (new RedactSensitiveData)->scrub([
        'password' => 'hunter2',
        'api_key' => 'sk_live_x',
        'token' => 'tok_abc',
        'authorization' => 'Bearer xyz',
        'signature' => 'deadbeef',
        'otp' => '654321',
        'code' => '999999',
        'phone' => '+91 98765 43210',
        'email' => 'john.doe@example.com',
        'amount_minor' => 250000,
        'nested' => ['password' => 'again', 'label' => 'keep-me'],
    ]);

    // Secret-bearing keys are removed wholesale.
    foreach (['password', 'api_key', 'token', 'authorization', 'signature', 'otp', 'code'] as $secret) {
        expect($scrubbed[$secret])->toBe('[redacted]');
    }

    // Contact fields are masked but keep a correlation tail; no raw value leaks.
    expect($scrubbed['phone'])->toEndWith('3210')
        ->and($scrubbed['phone'])->not->toContain('98765')
        ->and($scrubbed['email'])->toStartWith('j')
        ->and($scrubbed['email'])->toEndWith('@example.com')
        ->and($scrubbed['email'])->not->toContain('ohn.doe');

    // Non-sensitive values are preserved, and recursion reaches nested arrays.
    expect($scrubbed['amount_minor'])->toBe(250000)
        ->and($scrubbed['nested']['password'])->toBe('[redacted]')
        ->and($scrubbed['nested']['label'])->toBe('keep-me');
});

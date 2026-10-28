<?php

use App\Models\Customer;
use App\Models\IdempotencyKey;
use Illuminate\Support\Facades\Route;

/**
 * Item #5: the idempotency middleware gives create/pay endpoints exactly-once
 * semantics for clients that send an `Idempotency-Key`, while passing straight
 * through for the frozen clients that omit it (SKY-MRD-001 invariant #1).
 *
 * Each test registers a throwaway route guarded by the middleware whose side
 * effect (creating a Customer) is observable and reset per test.
 */
beforeEach(function () {
    Route::middleware('idempotency')->post('/__test/idem', function () {
        // Unique phone per real execution so repeated runs don't collide.
        $customer = Customer::create([
            'name' => 'Idem',
            'phone' => (string) (900000000 + Customer::count()),
        ]);

        return response()->json(['count' => Customer::count(), 'id' => $customer->id], 201);
    });

    Route::middleware('idempotency')->post('/__test/idem-500', function () {
        return response()->json(['success' => false], 500);
    });
});

it('replays the stored response for a repeated idempotency key without re-running the handler', function () {
    $first = $this->postJson('/__test/idem', ['a' => 1], ['Idempotency-Key' => 'key-1'])
        ->assertCreated()
        ->assertJsonPath('count', 1);

    $second = $this->postJson('/__test/idem', ['a' => 1], ['Idempotency-Key' => 'key-1'])
        ->assertCreated()
        ->assertJsonPath('count', 1) // NOT 2 — the handler did not run again
        ->assertHeader('Idempotent-Replayed', 'true');

    expect($second->json('id'))->toBe($first->json('id'))
        ->and(Customer::count())->toBe(1);
});

it('runs the handler every time when no idempotency key is sent', function () {
    $this->postJson('/__test/idem', ['a' => 1])->assertCreated()->assertJsonPath('count', 1);
    $this->postJson('/__test/idem', ['a' => 1])->assertCreated()->assertJsonPath('count', 2);

    expect(Customer::count())->toBe(2)
        ->and(IdempotencyKey::count())->toBe(0);
});

it('rejects reuse of an idempotency key with a different payload', function () {
    $this->postJson('/__test/idem', ['a' => 1], ['Idempotency-Key' => 'key-2'])->assertCreated();

    $this->postJson('/__test/idem', ['a' => 999], ['Idempotency-Key' => 'key-2'])
        ->assertStatus(422)
        ->assertJsonPath('success', false);

    expect(Customer::count())->toBe(1); // the conflicting request did not execute
});

it('returns 409 while a request with the same key is still in flight', function () {
    // Simulate an in-flight original: a claimed-but-not-completed record whose
    // request hash matches the incoming body.
    $body = ['a' => 1];
    IdempotencyKey::create([
        'scope' => 'anon:127.0.0.1',
        'idempotency_key' => 'key-3',
        'method' => 'POST',
        'path' => '__test/idem',
        'request_hash' => hash('sha256', json_encode($body)),
        'status' => IdempotencyKey::STATUS_PROCESSING,
    ]);

    $this->postJson('/__test/idem', $body, ['Idempotency-Key' => 'key-3'])
        ->assertStatus(409);

    expect(Customer::count())->toBe(0);
});

it('releases the key on a 5xx so the client can retry', function () {
    $this->postJson('/__test/idem-500', ['a' => 1], ['Idempotency-Key' => 'key-4'])
        ->assertStatus(500);

    // The key was released (not cached), leaving nothing to replay.
    expect(IdempotencyKey::count())->toBe(0);
});

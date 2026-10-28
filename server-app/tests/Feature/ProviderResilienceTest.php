<?php

use App\Exceptions\CircuitOpenException;
use App\Services\NotificationService;
use App\Services\RazorpayService;
use App\Support\CircuitBreaker;
use Illuminate\Support\Facades\Http;

/**
 * Item #8: provider resilience (SKY-MRD-001 §13.3). Every outbound provider
 * call is time-bounded, and repeated transport/5xx failures trip a circuit
 * breaker that fails fast during an outage instead of piling on retries. A
 * client error (4xx) is a bad request, not an outage, and must never trip it.
 */
it('opens after the failure threshold and then short-circuits the operation', function () {
    $breaker = new CircuitBreaker('cb-open-test', failureThreshold: 2, cooldownSeconds: 60);

    foreach ([1, 2] as $ignored) {
        $breaker->run(fn () => throw new RuntimeException('boom'), fn () => 'fell-back');
    }

    expect($breaker->isOpen())->toBeTrue();

    $liveCalls = 0;
    $result = $breaker->run(
        function () use (&$liveCalls) {
            $liveCalls++;

            return 'live';
        },
        fn () => 'short-circuited'
    );

    expect($result)->toBe('short-circuited')
        ->and($liveCalls)->toBe(0); // the operation is never invoked while open
});

it('resets the failure count after a success', function () {
    $breaker = new CircuitBreaker('cb-reset-test', failureThreshold: 3, cooldownSeconds: 60);

    $breaker->run(fn () => throw new RuntimeException('x'), fn () => null);
    $breaker->run(fn () => throw new RuntimeException('x'), fn () => null);
    $breaker->run(fn () => 'ok'); // success clears the counter

    expect($breaker->isOpen())->toBeFalse();

    // Two more failures must not open it — the pre-success failures were cleared.
    $breaker->run(fn () => throw new RuntimeException('x'), fn () => null);
    $breaker->run(fn () => throw new RuntimeException('x'), fn () => null);

    expect($breaker->isOpen())->toBeFalse();
});

it('throws CircuitOpenException when open and no fallback is given', function () {
    $breaker = new CircuitBreaker('cb-throw-test', failureThreshold: 1, cooldownSeconds: 60);

    $breaker->run(fn () => throw new RuntimeException('x'), fn () => null); // opens immediately

    expect($breaker->isOpen())->toBeTrue();
    expect(fn () => $breaker->run(fn () => 'live'))->toThrow(CircuitOpenException::class);
});

it('bounds Razorpay calls with a timeout and trips the breaker on repeated 5xx', function () {
    config([
        'resilience.circuit_breaker.razorpay.failure_threshold' => 3,
        'resilience.circuit_breaker.razorpay.cooldown_seconds' => 60,
    ]);
    Http::fake(['api.razorpay.com/*' => Http::response('gateway down', 500)]);

    $razorpay = app(RazorpayService::class);

    // Three real attempts hit the provider, each surfacing as an exception.
    foreach ([1, 2, 3] as $ignored) {
        expect(fn () => $razorpay->createOrder(100.0, 'rcpt_'.$ignored))->toThrow(Exception::class);
    }

    // The breaker is now open: the fourth call fails fast without a request.
    expect(fn () => $razorpay->createOrder(100.0, 'rcpt_4'))->toThrow(Exception::class);

    Http::assertSentCount(3);
});

it('does not trip the Razorpay breaker on client (4xx) errors', function () {
    config(['resilience.circuit_breaker.razorpay.failure_threshold' => 3]);
    Http::fake(['api.razorpay.com/*' => Http::response(['error' => 'bad request'], 400)]);

    $razorpay = app(RazorpayService::class);

    // Five 4xx responses: each throws a domain error but none counts as an
    // outage, so every call still reaches the provider (no short-circuit).
    foreach (range(1, 5) as $i) {
        expect(fn () => $razorpay->createOrder(100.0, 'rcpt_'.$i))->toThrow(Exception::class);
    }

    Http::assertSentCount(5);
});

it('stops calling the SMS provider once its breaker opens', function () {
    config([
        'services.mtalkz.base_url' => 'https://msg.mtalkz.com/V2/http-api.php',
        'services.mtalkz.api_key' => 'test-key',
        'services.mtalkz.sender_id' => 'HAPYML',
        'services.mtalkz.entity_id' => '1234567890123456789',
        'resilience.circuit_breaker.mtalkz.failure_threshold' => 3,
        'resilience.circuit_breaker.mtalkz.cooldown_seconds' => 60,
    ]);
    Http::fake(['msg.mtalkz.com/*' => Http::response('mtalkz down', 500)]);

    $notifications = app(NotificationService::class);

    // Best-effort delivery: each failure returns false rather than throwing.
    foreach ([1, 2, 3] as $ignored) {
        expect($notifications->sendSms('9990001111', 'ping'))->toBeFalse();
    }

    // Breaker open — subsequent sends short-circuit without touching mTalkz.
    expect($notifications->sendSms('9990001111', 'ping'))->toBeFalse();

    Http::assertSentCount(3);
});

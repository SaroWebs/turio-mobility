<?php

use App\Jobs\ProcessOutboxMessage;
use App\Models\OutboxMessage;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;

/**
 * Item #6: the transactional outbox (SKY-MRD-001 §8.9). Notifications are
 * written durably to `outbox_messages` in the caller's transaction and
 * delivered asynchronously by ProcessOutboxMessage with retry/backoff and
 * dead-lettering — never sent inline in the request path.
 */
it('writes a pending outbox row and does not deliver inline under the sync queue', function () {
    Http::fake();

    $user = (object) ['phone' => '9990001111', 'email' => null];

    $messages = app(NotificationService::class)->enqueue($user, ['sms'], ['sms' => 'Hello outbox']);

    expect($messages)->toHaveCount(1);

    $row = OutboxMessage::sole();
    expect($row->status)->toBe(OutboxMessage::STATUS_PENDING)
        ->and($row->channel)->toBe('sms')
        ->and($row->recipient)->toBe('9990001111')
        ->and($row->body)->toBe('Hello outbox');

    Http::assertNothingSent(); // enqueue must never touch a provider
});

it('enqueues a channel at most once for a given dedup key', function () {
    $user = (object) ['phone' => '9990002222'];
    $service = app(NotificationService::class);

    $service->enqueue($user, ['sms'], ['sms' => 'first'], ['dedup_key' => 'evt:1']);
    $service->enqueue($user, ['sms'], ['sms' => 'second'], ['dedup_key' => 'evt:1']);

    expect(OutboxMessage::count())->toBe(1)
        ->and(OutboxMessage::sole()->body)->toBe('first'); // first write wins
});

it('delivers a configured sms outbox message and marks it sent', function () {
    config([
        'services.mtalkz.base_url' => 'https://msg.mtalkz.com/V2/http-api.php',
        'services.mtalkz.api_key' => 'test-key',
        'services.mtalkz.sender_id' => 'HAPYML',
        'services.mtalkz.entity_id' => '1234567890123456789',
        'services.mtalkz.templates.transactional' => 'TPL-TXN-1',
    ]);
    Http::fake(['msg.mtalkz.com/*' => Http::response(['status' => 'success'], 200)]);

    $message = OutboxMessage::create([
        'channel' => 'sms',
        'recipient' => '9990003333',
        'body' => 'Ping',
        'status' => OutboxMessage::STATUS_PENDING,
        'available_at' => now(),
    ]);

    (new ProcessOutboxMessage($message->id))->handle(app(NotificationService::class));

    expect($message->fresh()->status)->toBe(OutboxMessage::STATUS_SENT);
    Http::assertSent(fn ($request) => str_contains($request->url(), 'msg.mtalkz.com')
        && $request['senderid'] === 'HAPYML'
        && $request['dlttemplateid'] === 'TPL-TXN-1'); // DLT template id is carried per message
});

it('skips delivery when the channel provider is not configured', function () {
    config([
        'services.mtalkz.api_key' => null,
        'services.mtalkz.sender_id' => null,
        'services.mtalkz.entity_id' => null,
    ]);
    Http::fake();

    $message = OutboxMessage::create([
        'channel' => 'sms',
        'recipient' => '9990004444',
        'body' => 'Ping',
        'status' => OutboxMessage::STATUS_PENDING,
        'available_at' => now(),
    ]);

    (new ProcessOutboxMessage($message->id))->handle(app(NotificationService::class));

    expect($message->fresh()->status)->toBe(OutboxMessage::STATUS_SKIPPED);
    Http::assertNothingSent();
});

it('retries a failed delivery with backoff and dead-letters after max attempts', function () {
    config([
        'services.mtalkz.base_url' => 'https://msg.mtalkz.com/V2/http-api.php',
        'services.mtalkz.api_key' => 'test-key',
        'services.mtalkz.sender_id' => 'HAPYML',
        'services.mtalkz.entity_id' => '1234567890123456789',
    ]);
    Http::fake(['msg.mtalkz.com/*' => Http::response('provider down', 500)]);

    $message = OutboxMessage::create([
        'channel' => 'sms',
        'recipient' => '9990005555',
        'body' => 'Ping',
        'status' => OutboxMessage::STATUS_PENDING,
        'max_attempts' => 3,
        'available_at' => now(),
    ]);

    $job = new ProcessOutboxMessage($message->id);
    $service = app(NotificationService::class);

    // Attempts 1 and 2 fail, record the error, and reschedule with backoff.
    foreach ([1, 2] as $attempt) {
        expect(fn () => $job->handle($service))->toThrow(RuntimeException::class);

        $message->refresh();
        expect($message->status)->toBe(OutboxMessage::STATUS_FAILED)
            ->and($message->attempts)->toBe($attempt)
            ->and($message->available_at->isFuture())->toBeTrue();
    }

    // Third attempt exhausts max_attempts → dead-lettered, and does not throw.
    $job->handle($service);

    $message->refresh();
    expect($message->status)->toBe(OutboxMessage::STATUS_DEAD)
        ->and($message->attempts)->toBe(3);
});

it('drains due outbox messages and reclaims stranded processing rows', function () {
    Bus::fake();

    // Due now → dispatched.
    OutboxMessage::create([
        'channel' => 'sms', 'recipient' => '9990006666', 'body' => 'due',
        'status' => OutboxMessage::STATUS_PENDING, 'available_at' => now()->subMinute(),
    ]);
    // Scheduled for later → not dispatched.
    OutboxMessage::create([
        'channel' => 'sms', 'recipient' => '9990007777', 'body' => 'later',
        'status' => OutboxMessage::STATUS_PENDING, 'available_at' => now()->addHour(),
    ]);
    // Stranded in processing by a crashed worker → reclaimed to failed + due.
    $stranded = OutboxMessage::create([
        'channel' => 'sms', 'recipient' => '9990008888', 'body' => 'stuck',
        'status' => OutboxMessage::STATUS_PROCESSING, 'dispatched_at' => now()->subMinutes(30),
    ]);

    $this->artisan('outbox:drain')->assertSuccessful();

    expect($stranded->fresh()->status)->toBe(OutboxMessage::STATUS_FAILED);

    // The originally-due row plus the reclaimed one; the future row is skipped.
    Bus::assertDispatchedTimes(ProcessOutboxMessage::class, 2);
});

<?php

use App\Models\Otp;
use App\Services\MtalkzSmsService;
use App\Services\OtpService;
use Illuminate\Support\Facades\Http;

/**
 * Item #9: mTalkz is the selected SMS provider, replacing Twilio on the SMS
 * path (OTP + transactional notifications). India TRAI/DLT compliance means
 * every send carries a registered sender header (`senderid`), the principal
 * entity id (`dltentityid`) and the per-message content-template id
 * (`dlttemplateid`).
 */

/** Configure real, non-placeholder mTalkz credentials for the send path. */
function configureMtalkz(): void
{
    config([
        'services.mtalkz.base_url' => 'https://msg.mtalkz.com/V2/http-api.php',
        'services.mtalkz.api_key' => 'test-key',
        'services.mtalkz.sender_id' => 'HAPYML',
        'services.mtalkz.entity_id' => '1234567890123456789',
        'services.mtalkz.route' => 'TRANS',
        'services.mtalkz.templates.otp' => 'TPL-OTP-1',
        'services.mtalkz.templates.transactional' => 'TPL-TXN-1',
    ]);
}

it('sends an SMS via mTalkz with the DLT template id and a normalized number', function () {
    configureMtalkz();
    Http::fake(['msg.mtalkz.com/*' => Http::response(['status' => 'success'], 200)]);

    $sent = app(MtalkzSmsService::class)->send('+91 99900 01111', 'Your code is 4321', 'TPL-TXN-1');

    expect($sent)->toBeTrue();
    Http::assertSent(function ($request) {
        return str_contains($request->url(), 'msg.mtalkz.com')
            && $request['apikey'] === 'test-key'
            && $request['senderid'] === 'HAPYML'
            && $request['dltentityid'] === '1234567890123456789'
            && $request['dlttemplateid'] === 'TPL-TXN-1'
            && $request['route'] === 'TRANS'
            && $request['number'] === '919990001111'; // '+' and spaces stripped
    });
});

it('reports unconfigured and skips the send when credentials are placeholders', function () {
    config([
        'services.mtalkz.base_url' => 'https://msg.mtalkz.com/V2/http-api.php',
        'services.mtalkz.api_key' => 'your_api_key_here',
        'services.mtalkz.sender_id' => null,
    ]);
    Http::fake();

    $service = app(MtalkzSmsService::class);

    expect($service->isConfigured())->toBeFalse()
        ->and($service->send('9990001111', 'ping', 'TPL-TXN-1'))->toBeFalse();

    Http::assertNothingSent();
});

it('stops calling mTalkz once the breaker opens', function () {
    configureMtalkz();
    config([
        'resilience.circuit_breaker.mtalkz.failure_threshold' => 3,
        'resilience.circuit_breaker.mtalkz.cooldown_seconds' => 60,
    ]);
    Http::fake(['msg.mtalkz.com/*' => Http::response('mtalkz down', 500)]);

    $service = app(MtalkzSmsService::class);

    // Best-effort: each failure returns false rather than throwing.
    foreach ([1, 2, 3] as $ignored) {
        expect($service->send('9990001111', 'ping', 'TPL-TXN-1'))->toBeFalse();
    }

    // Breaker open — further sends short-circuit without a request.
    expect($service->send('9990001111', 'ping', 'TPL-TXN-1'))->toBeFalse();

    Http::assertSentCount(3);
});

it('delivers OTP through mTalkz with the OTP template id when dev delivery is off', function () {
    config(['services.otp.allow_dev_delivery' => false]);
    configureMtalkz();
    Http::fake(['msg.mtalkz.com/*' => Http::response(['status' => 'success'], 200)]);

    $result = app(OtpService::class)->send('9990002222', 'customer');

    expect($result['success'])->toBeTrue()
        ->and($result)->not->toHaveKey('dev_otp'); // real path never leaks the code back

    // The OTP row persists and the send used the OTP-specific DLT template.
    $otp = Otp::where('phone', '9990002222')->where('type', 'customer')->sole();
    Http::assertSent(fn ($request) => str_contains($request->url(), 'msg.mtalkz.com')
        && $request['dlttemplateid'] === 'TPL-OTP-1'
        && str_contains($request['text'], $otp->code)); // the code is in the SMS body sent to the provider
});

it('fails OTP delivery closed when mTalkz is unconfigured', function () {
    config([
        'services.otp.allow_dev_delivery' => false,
        'services.mtalkz.api_key' => null,
        'services.mtalkz.sender_id' => null,
    ]);
    Http::fake();

    $result = app(OtpService::class)->send('9990003333', 'customer');

    expect($result['success'])->toBeFalse()
        ->and($result['status_code'])->toBe(503);

    // The unsent OTP row is rolled back so a later retry is not throttled.
    expect(Otp::where('phone', '9990003333')->exists())->toBeFalse();
    Http::assertNothingSent();
});

<?php

use App\Services\ProductionReadinessService;
use Illuminate\Support\Facades\Artisan;

it('reports critical failures for unsafe production configuration', function () {
    config([
        'app.env' => 'production',
        'app.debug' => true,
        'app.key' => null,
        'app.url' => 'http://example.com',
        'session.secure' => false,
        'database.default' => 'sqlite',
        'queue.default' => 'sync',
        'mail.default' => 'log',
        'services.otp.allow_dev_delivery' => true,
        'services.mtalkz.api_key' => null,
        'services.mtalkz.sender_id' => null,
        'services.mtalkz.entity_id' => null,
        'services.razorpay.key' => null,
        'services.razorpay.secret' => null,
        'services.razorpay.webhook_secret' => null,
        'services.maps.provider' => 'fallback',
        'broadcasting.default' => 'log',
    ]);

    $report = app(ProductionReadinessService::class)->report();

    expect($report['ready'])->toBeFalse()
        ->and($report['summary']['critical_failures'])->toBeGreaterThan(0);
});

it('returns a failing exit code from the production readiness command when critical checks fail', function () {
    config([
        'app.env' => 'production',
        'app.debug' => true,
        'app.key' => null,
    ]);

    expect(Artisan::call('skyslope:production-readiness'))->toBe(1);
});

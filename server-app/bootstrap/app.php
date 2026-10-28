<?php

use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\EnforceIdempotency;
use App\Http\Middleware\EnsureResponseMeta;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\PermissionMiddleware;
use App\Http\Middleware\RoleMiddleware;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['middleware' => ['api', 'auth:sanctum']],
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->validateCsrfTokens(except: [
            'api/ride-bookings/estimate',
            'api/customer-app/*',
            'api/driver-app/*',
        ]);

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Correlation ids on every request (SKY-MRD-001 §13.2): prepend so the
        // id exists before any other middleware or handler logs. On the api
        // group EnsureResponseMeta (appended) then surfaces it as meta.request_id.
        $middleware->api(prepend: [
            AssignRequestId::class,
        ], append: [
            EnsureResponseMeta::class,
        ]);

        $middleware->web(prepend: [
            AssignRequestId::class,
        ]);

        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'idempotency' => EnforceIdempotency::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })
    ->withSchedule(function (Schedule $schedule) {
        $schedule->command('rides:expire-requests')->everyMinute()->withoutOverlapping();
        $schedule->command('tours:start-attendance')->everyMinute()->withoutOverlapping();
        $schedule->command('tours:expire-holds')->everyMinute()->withoutOverlapping();
        $schedule->command('tours:reconcile-inventory')->hourly()->withoutOverlapping();
        $schedule->command('rides:dispatch-due')->everyMinute()->withoutOverlapping();
        $schedule->command('rides:expire-stale-assigned')->everyMinute()->withoutOverlapping();
        $schedule->command('rides:purge-requests --execute')->daily()->withoutOverlapping()->when(fn () => (bool) setting('ride.retention.purge_enabled', false));
        // SKY-MRD-001 §13.3 — background sweeps. Every minute, non-overlapping
        // so a slow run never stacks on top of the next tick. These commands
        // were defined but had no scheduler to run them until now.
        $schedule->command('dispatch:expire-ride-attempts')
            ->everyMinute()
            ->withoutOverlapping();

        $schedule->command('dispatch:expire-stale-availability')
            ->everyMinute()
            ->withoutOverlapping();

        $schedule->command('outbox:drain')
            ->everyMinute()
            ->withoutOverlapping();

        // Nightly reconciliation (SKY-MRD-001 §8.7, §13.3): cross-check the
        // ledger against payments, payouts, and provider settlements, writing
        // discrepancies to reconciliation_mismatches for a human to resolve.
        $schedule->command('reconcile:run')
            ->dailyAt('01:30')
            ->withoutOverlapping();
    })->create();

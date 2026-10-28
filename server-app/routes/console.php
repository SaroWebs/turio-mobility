<?php

\Illuminate\Support\Facades\Schedule::command('carpool:maintain')->everyMinute()->withoutOverlapping();
\Illuminate\Support\Facades\Schedule::command('verification:monitor-expiry')->daily()->withoutOverlapping();

use App\Services\DriverDispatchService;
use App\Services\ProductionReadinessService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('dispatch:expire-ride-attempts', function (DriverDispatchService $dispatchService) {
    $count = $dispatchService->expireOpenAttempts();
    $this->info("Expired {$count} ride dispatch attempt(s).");
})->purpose('Expire unaccepted ride dispatch attempts');

Artisan::command('dispatch:expire-stale-availability {--seconds= : Age in seconds after which an online driver with no location update is taken offline}', function (DriverDispatchService $dispatchService) {
    $seconds = $this->option('seconds') !== null
        ? (int) $this->option('seconds')
        : null;
    $count = $dispatchService->expireStaleAvailability($seconds);
    $this->info("Marked {$count} stale driver availability record(s) offline.");
})->purpose('Take drivers offline when their location tracking goes stale');

Artisan::command('skyslope:production-readiness {--json : Output the full report as JSON}', function (ProductionReadinessService $readiness) {
    $report = $readiness->report();

    if ($this->option('json')) {
        $this->line(json_encode($report, JSON_PRETTY_PRINT));

        return $report['ready'] ? self::SUCCESS : self::FAILURE;
    }

    $this->info($report['ready'] ? 'Turiya Mobility server app is production-ready.' : 'Turiya Mobility server app is not production-ready yet.');
    $this->line("Passed {$report['summary']['passed']} of {$report['summary']['total']} checks.");

    collect($report['checks'])
        ->filter(fn (array $check) => ! $check['passed'])
        ->each(function (array $check) {
            $this->line(sprintf('[%s] %s: %s', strtoupper($check['severity']), $check['key'], $check['message']));
        });

    return $report['ready'] ? self::SUCCESS : self::FAILURE;
})->purpose('Check production-critical Turiya Mobility server configuration');

Artisan::command('rides:expire-requests', function (\App\Services\RideRequestLifecycle $service) {
    $this->info('Expired '.$service->expire().' unanswered requests.');
});
Artisan::command('tours:expire-holds', function (\App\Services\BookingCancellationService $service) {
    $count = 0;
    \App\Models\TourBooking::where('status', 'pending')->where('payment_status', 'pending')
        ->where('hold_expires_at', '<=', now())->chunkById(100, function ($rows) use ($service, &$count) {
            foreach ($rows as $row) {
                \Illuminate\Support\Facades\DB::transaction(function () use ($row, $service, &$count) {
                    $booking = \App\Models\TourBooking::lockForUpdate()->find($row->id);
                    if (! $booking || $booking->status !== 'pending'
                        || $booking->payment_status !== 'pending'
                        || ! $booking->hold_expires_at?->lte(now())) {
                        return;
                    }
                    $service->cancel($booking, 'tour', 'Seat reservation expired before payment confirmation.', null, 'system');
                    $count++;
                });
            }
        });
    $this->info('Expired '.$count.' tour holds.');
});
Artisan::command('rentals:expire-holds', function (\App\Services\BookingCancellationService $service) {
    $count = 0;
    \App\Models\CarRental::whereIn('status', ['pending', 'driver_assigned'])
        ->where('payment_status', 'pending')
        ->whereNotNull('hold_expires_at')
        ->where('hold_expires_at', '<=', now())
        ->chunkById(100, function ($rows) use ($service, &$count) {
            foreach ($rows as $row) {
                \Illuminate\Support\Facades\DB::transaction(function () use ($row, $service, &$count) {
                    $rental = \App\Models\CarRental::lockForUpdate()->find($row->id);
                    if (! $rental || ! in_array($rental->status, ['pending', 'driver_assigned'], true)
                        || $rental->payment_status !== 'pending'
                        || ! $rental->hold_expires_at?->lte(now())) {
                        return;
                    }
                    $service->cancel($rental, 'rental', 'Rental hold expired before payment confirmation.', null, 'system');
                    $count++;
                });
            }
        });
    $this->info('Expired '.$count.' rental holds.');
});
Artisan::command('tours:reconcile-inventory {--repair : Replace counters with durable booking totals}', function (\App\Services\TourInventoryReconciliation $service) {
    $this->info(json_encode($service->run((bool) $this->option('repair'))));
});
Artisan::command('rides:dispatch-due', function (DriverDispatchService $service) {
    $this->info('Dispatched '.$service->dispatchDueRides().' due ride requests.');
});
Artisan::command('rides:expire-stale-assigned', function (\App\Services\RideRequestLifecycle $service) {
    $this->info('Expired '.$service->expireStaleAssignedRides().' stale assigned rides.');
    $this->info('Recovered '.app(DriverDispatchService::class)->recoverOrphanedAvailability().' orphaned driver availability records.');
});
Artisan::command('rides:purge-requests {--execute : Delete eligible expired requests}', function (\App\Services\RideRequestLifecycle $service) {
    $execute = $this->option('execute');
    if ($execute && ! setting('ride.retention.purge_enabled', false)) {
        $this->error('Enable request purge in admin settings first.');

        return 1;
    }
    $result = $service->purge(! $execute);
    \Illuminate\Support\Facades\Cache::forever('ride-request-purge-last', ['at' => now()->toIso8601String(), 'dry_run' => ! $execute, ...$result]);
    $this->info(json_encode($result));
});

Artisan::command('tours:send-departure-reminders {--hours= : Reminder lead time window in hours}', function () {
    $hours = $this->option('hours') !== null
        ? (int) $this->option('hours')
        : (int) setting('tour.departure_reminder_hours', 24);

    $now = now()->utc();
    $cutoff = $now->copy()->addHours($hours);

    $count = 0;
    \App\Models\TourBooking::with(['schedule.tour', 'customer'])
        ->whereIn('status', ['confirmed', 'in_progress'])
        ->whereIn('payment_status', ['paid', 'partial'])
        ->whereHas('schedule', function ($q) use ($now, $cutoff) {
            $q->where('departure_at', '>=', $now)
                ->where('departure_at', '<=', $cutoff);
        })
        ->chunkById(100, function ($bookings) use ($hours, &$count) {
            foreach ($bookings as $booking) {
                $dedupKey = "booking:tour:{$booking->id}:booking.departure_reminder:{$hours}h";
                if (\App\Models\OutboxMessage::where('dedup_key', 'like', "{$dedupKey}:%")->exists()) {
                    continue;
                }

                app(\App\Services\BookingLifecycleNotifier::class)->emit($booking, 'booking.departure_reminder', [
                    'hours' => $hours,
                    'travel_date' => optional($booking->schedule->departure_date)->toDateString(),
                    'departure_time' => $booking->schedule->departure_time,
                    'departure_point' => $booking->schedule->departure_point,
                    'reminder_window' => "{$hours}h",
                ]);
                $count++;
            }
        });

    $this->info("Dispatched departure reminders for {$count} booking(s).");
})->purpose('Send automated pre-departure reminders for upcoming tours');

Artisan::command('tours:start-attendance', function (\App\Services\TourAttendanceService $service) {
    \App\Models\TourBooking::where('status', 'confirmed')->whereNull('attendance_status')
        ->whereHas('schedule', fn ($q) => $q->where('departure_at', '<=', now()))
        ->chunkById(100, function ($bookings) use ($service) {
            foreach ($bookings as $booking) {
                $service->startWaiting($booking);
            }
        });
});

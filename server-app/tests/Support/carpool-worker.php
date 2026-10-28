<?php

// Separate process, real DB connection, synchronized start. Only used by the integration test.
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => $argv[1], 'database.connections.sqlite.busy_timeout' => 10000,
    'app.key' => $argv[5], 'queue.default' => 'sync']);
Illuminate\Support\Facades\DB::purge('sqlite');
$deadline = microtime(true) + 15;
while (! file_exists($argv[4]) && microtime(true) < $deadline) {
    usleep(10000);
}
try {
    $ride = App\Models\CarpoolRide::findOrFail((int) $argv[2]);
    $actor = App\Models\Customer::findOrFail((int) $argv[3]);
    $booking = app(App\Services\CarpoolService::class)->book($actor, $ride->id,
        ['seats' => 1, 'payment_method' => 'cash', 'policy_version' => 1, 'price_minor' => $ride->price_minor, 'accept_terms' => true], 'worker-'.$actor->id);
    echo json_encode(['status' => 200, 'booking' => $booking->id]);
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    echo json_encode(['status' => $e->getStatusCode(), 'message' => $e->getMessage()]);
} catch (Throwable $e) {
    echo json_encode(['status' => 500, 'message' => $e->getMessage()]);
    exit(1);
}

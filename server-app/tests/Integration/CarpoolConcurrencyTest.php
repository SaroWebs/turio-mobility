<?php

namespace Tests\Integration;

use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\TestCase;

require_once __DIR__.'/../Support/CarpoolFixtures.php';

class CarpoolConcurrencyTest extends TestCase
{
    public function test_two_independent_processes_cannot_take_the_last_seat(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'carpool-seat-');
        $barrier = $path.'.go';
        $workers = [];
        try {
            config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => $path, 'database.connections.sqlite.busy_timeout' => 10000,
                'app.key' => 'base64:'.base64_encode(str_repeat('c', 32))]);
            DB::purge('sqlite');
            $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
            [$ride] = \carpoolFixture();
            foreach ([\carpoolPassenger(), \carpoolPassenger()] as $passenger) {
                $process = new Process([PHP_BINARY, '-d', 'xdebug.mode=off', base_path('tests/Support/carpool-worker.php'), $path, (string) $ride->id, (string) $passenger->id, $barrier, config('app.key')], base_path(), ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => $path]);
                $process->setTimeout(30);
                $process->start();
                $workers[] = $process;
            }
            touch($barrier);
            $statuses = [];
            foreach ($workers as $process) {
                $process->wait();
                $result = json_decode($process->getOutput(), true);
                $this->assertNotNull($result, $process->getOutput().$process->getErrorOutput());
                $this->assertNotSame(500, $result['status'], $result['message'] ?? '');
                $statuses[] = $result['status'];
            }
            sort($statuses);
            $this->assertSame([200, 409], $statuses);
            $this->assertSame(1, $ride->bookings()->where('status', 'confirmed')->count());
            $this->assertSame(0, app(\App\Services\CarpoolService::class)->remaining($ride));
        } finally {
            foreach ($workers as $worker) {
                if ($worker->isRunning()) {
                    $worker->stop();
                }
            }
            DB::disconnect('sqlite');
            if (file_exists($barrier)) {
                unlink($barrier);
            }
            if (file_exists($path)) {
                unlink($path);
            }
        }
    }
}

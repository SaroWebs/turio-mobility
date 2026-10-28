<?php

namespace App\Console\Commands;

use App\Services\ReconciliationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Runs the reconciliation sweep (SKY-MRD-001 §8.7, §13.3). Scheduled nightly in
 * bootstrap/app.php; also runnable on demand to investigate a suspected drift.
 * Exit code is non-zero when open mismatches remain, so a CI/cron wrapper can
 * alert on it.
 */
class RunReconciliation extends Command
{
    protected $signature = 'reconcile:run
        {--from= : Window start (any parseable date/time); defaults to --days before --to}
        {--to= : Window end (any parseable date/time); defaults to now}
        {--days=1 : Window length in days when --from is omitted}
        {--no-provider : Skip the Razorpay settlement cross-check}';

    protected $description = 'Reconcile the ledger against payments, payouts, and provider settlements';

    public function handle(ReconciliationService $service): int
    {
        $to = $this->option('to') ? Carbon::parse($this->option('to')) : now();
        $from = $this->option('from')
            ? Carbon::parse($this->option('from'))
            : $to->copy()->subDays((int) $this->option('days'));

        $report = $service->run($from, $to, ! $this->option('no-provider'));

        $this->info(sprintf(
            'Reconciliation %s [%s → %s]: %d mismatch(es) — %d opened, %d updated, %d resolved. Provider: %s.',
            $report['run_id'],
            $report['from'],
            $report['to'],
            $report['mismatches'],
            $report['opened'],
            $report['updated'],
            $report['resolved'],
            $report['provider'],
        ));

        foreach ($report['by_type'] as $type => $count) {
            $this->line(sprintf('  - %s: %d', $type, $count));
        }

        // Non-zero exit when discrepancies are outstanding so schedulers/CI alert.
        return $report['mismatches'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}

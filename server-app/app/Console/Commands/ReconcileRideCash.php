<?php

namespace App\Console\Commands;

use App\Services\CashCollectionReconciliation;
use Illuminate\Console\Command;

class ReconcileRideCash extends Command
{
    protected $signature = 'rides:reconcile-cash {--json : Print a machine-readable report}';

    protected $description = 'Audit ride cash receipts, ledger postings and duplicate wallet settlement without changing money records';

    public function handle(CashCollectionReconciliation $reconciliation): int
    {
        $report = $reconciliation->run();
        if ($this->option('json')) {
            $this->line(json_encode($report, JSON_THROW_ON_ERROR));
        } else {
            $this->info('Checked '.$report['checked'].' cash receipts; declared cash: '.$report['collected_minor'].' paise; exceptions: '.count($report['issues']).'.');
            foreach ($report['issues'] as $issue) {
                $this->warn($issue['code'].' booking='.$issue['booking_id'].' payment='.$issue['payment_id']);
            }
        }

        return $report['issues'] === [] ? self::SUCCESS : self::FAILURE;
    }
}

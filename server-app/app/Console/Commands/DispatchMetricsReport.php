<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\DispatchMetricsService;
use Carbon\Carbon;

class DispatchMetricsReport extends Command
{
    protected $signature = 'dispatch:metrics-report {--days=1 : Number of days to report on}';
    protected $description = 'Outputs daily/weekly metrics for dispatch fairness and quality';

    public function handle(DispatchMetricsService $metricsService)
    {
        $days = (int) $this->option('days');
        $since = now()->subDays($days);
        
        $metrics = $metricsService->metrics($since);

        $this->info("Dispatch Metrics Report (Last {$days} days)");
        $this->line("-----------------------------------------");
        $this->line("Time to Assign (avg sec): " . round($metrics['time_to_assign'], 2));
        $this->line("Acceptance Rate: " . round($metrics['acceptance_rate'], 2) . "%");
        $this->line("No-Driver Rate: " . round($metrics['no_driver_rate'], 2) . "%");
        $this->line("Offer Distribution (Gini): " . round($metrics['offer_distribution'], 4));

        return 0;
    }
}

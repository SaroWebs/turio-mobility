<?php

namespace App\Console\Commands;

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Services\Verification\DocumentWorkflow;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MonitorVerificationExpiry extends Command
{
    protected $signature = 'verification:monitor-expiry';

    protected $description = 'Expire versioned driver documents and issue deduplicated reminders';

    public function handle(DocumentWorkflow $workflow): int
    {
        $thresholds = collect(config('document_verification.reminder_days', [30, 15, 7]))->filter(fn ($day) => is_numeric($day) && $day >= 0)->map(fn ($day) => (int) $day)->unique()->sort()->values()->all();
        DriverDocument::where('version', '>', 0)->whereNotNull('expires_at')->where('expires_at', '<=', today()->addDays(max($thresholds ?: [0])))
            ->chunkById(100, function ($documents) use ($workflow, $thresholds) {
                foreach ($documents as $document) {
                    DB::transaction(function () use ($document, $workflow, $thresholds) {
                        Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
                        $current = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
                        if ($current->expires_at?->lt(today()) && in_array($current->status, DocumentWorkflow::ACTIONS['expired'], true)) {
                            $from = $current->status;
                            $current->update(['status' => 'expired', 'rejection_reason' => 'Document expired. Submit a current replacement.']);
                            $workflow->audit($current, null, 'expired', $from, 'Document expired.');
                            $workflow->notice($current, 'expired', 'A document expired. Submit a replacement for review.');
                        } elseif ($current->status === 'approved' && $current->expires_at?->gte(today())) {
                            $days = (int) today()->diffInDays($current->expires_at);
                            // A delayed scheduler still sends the most urgent applicable reminder.
                            foreach ($thresholds as $threshold) {
                                if ($days <= $threshold) {
                                    $workflow->notice($current, 'expiry-'.$threshold, "A document expires within {$threshold} days. Contact your reviewer to arrange renewal.");
                                    break;
                                }
                            }
                        }
                    });
                }
            });
        $this->info('Document expiration monitoring completed.');

        return self::SUCCESS;
    }
}

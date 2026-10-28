<?php

namespace App\Console\Commands;

use App\Jobs\ProcessOutboxMessage;
use App\Models\OutboxMessage;
use Illuminate\Console\Command;

/**
 * Drains the notification outbox (SKY-MRD-001 §8.9). This is the durability
 * backstop for the transactional outbox: it dispatches any due message whose
 * delivery job was never enqueued (e.g. the process died between the commit and
 * the afterCommit dispatch) and reclaims rows stranded in `processing` by a
 * crashed worker. Intended to run on a short schedule (wired in item #7).
 */
class DrainNotificationOutbox extends Command
{
    protected $signature = 'outbox:drain {--limit=200 : Max messages to dispatch per run} {--reclaim=5 : Minutes after which a processing row is considered stranded}';

    protected $description = 'Dispatch due outbox notifications and reclaim stranded processing rows';

    public function handle(): int
    {
        // Reclaim rows stuck in `processing` (worker died mid-delivery) so they
        // become due again.
        $reclaimed = OutboxMessage::where('status', OutboxMessage::STATUS_PROCESSING)
            ->where('dispatched_at', '<=', now()->subMinutes((int) $this->option('reclaim')))
            ->update([
                'status' => OutboxMessage::STATUS_FAILED,
                'available_at' => now(),
            ]);

        $dispatched = 0;
        OutboxMessage::due(now())
            ->limit((int) $this->option('limit'))
            ->get()
            ->each(function (OutboxMessage $message) use (&$dispatched) {
                ProcessOutboxMessage::dispatch($message->id);
                $dispatched++;
            });

        $this->info("Outbox drain: dispatched {$dispatched} message(s), reclaimed {$reclaimed} stranded row(s).");

        return self::SUCCESS;
    }
}

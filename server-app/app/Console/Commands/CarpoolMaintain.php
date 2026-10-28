<?php

namespace App\Console\Commands;

use App\Models\CarpoolBooking;
use App\Models\CarpoolRide;
use App\Services\CarpoolPayments;
use App\Services\CarpoolService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CarpoolMaintain extends Command
{
    protected $signature = 'carpool:maintain';

    protected $description = 'Release expired carpool holds, send reminders and process eligible settlements';

    public function handle(CarpoolService $service, CarpoolPayments $payments): int
    {
        CarpoolRide::whereIn('status', ['published', 'in_progress'])->chunkById(100, function ($rides) use ($service) {
            foreach ($rides as $ride) {
                DB::transaction(function () use ($ride, $service) {
                    $ride = CarpoolRide::lockForUpdate()->findOrFail($ride->id);
                    $service->expire($ride);
                    if ($ride->departure_at->between(now(), now()->addDay())) {
                        foreach ($ride->bookings()->where('status', 'confirmed')->whereNull('reminded_at')->get() as $b) {
                            $service->notify($b, 'departure_reminder');
                            $b->update(['reminded_at' => now()]);
                        }
                    }
                }, 5);
            }
        });
        CarpoolBooking::where('refund_status', 'pending')->orWhere(fn ($q) => $q->where('payout_eligible_at', '<=', now())->where('payout_status', 'ineligible'))
            ->chunkById(100, function ($bookings) use ($payments) {
                foreach ($bookings as $b) {
                    $payments->settle($b->id);
                }
            });

        return self::SUCCESS;
    }
}

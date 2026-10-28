<?php

namespace App\Console\Commands;

use App\Models\Driver;
use App\Models\Guide;
use App\Models\TourDriverAssignment;
use App\Models\TourGuideAssignment;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class MigrateGuidesToDrivers extends Command
{
    protected $signature = 'guides:migrate-to-drivers
        {--dry-run : Show what would change without writing anything}
        {--force : Overwrite existing driver profile/status fields with guide values}
        {--sync-assignments : Copy legacy tour guide assignments into tour driver assignments}';

    protected $description = 'Copy legacy guide accounts into driver accounts while preserving guide records for audit.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        $syncAssignments = (bool) $this->option('sync-assignments');

        $guides = Guide::query()->orderBy('id')->get();

        if ($guides->isEmpty()) {
            $this->info('No guide records found.');

            return self::SUCCESS;
        }

        $summary = [
            'created' => 0,
            'updated' => 0,
            'unchanged' => 0,
            'assignments_synced' => 0,
            'assignments_skipped' => 0,
        ];

        $runner = function () use ($guides, $force, $syncAssignments, &$summary): void {
            foreach ($guides as $guide) {
                [$driver, $created] = $this->upsertDriverForGuide($guide, $force);

                if ($created) {
                    $summary['created']++;
                    $this->line("Created driver #{$driver->id} from guide #{$guide->id} ({$guide->phone}).");
                } elseif ($driver->wasChanged()) {
                    $summary['updated']++;
                    $this->line("Updated driver #{$driver->id} from guide #{$guide->id} ({$guide->phone}).");
                } else {
                    $summary['unchanged']++;
                    $this->line("Driver #{$driver->id} already matched guide #{$guide->id} ({$guide->phone}).");
                }

                if ($syncAssignments) {
                    [$synced, $skipped] = $this->syncAssignments($guide, $driver);
                    $summary['assignments_synced'] += $synced;
                    $summary['assignments_skipped'] += $skipped;
                }
            }
        };

        if ($dryRun) {
            DB::beginTransaction();

            try {
                $runner();
            } finally {
                DB::rollBack();
            }

            $this->warn('Dry run only. No database changes were kept.');
        } else {
            DB::transaction($runner);
        }

        $this->table(['Metric', 'Count'], collect($summary)->map(fn ($count, $metric) => [$metric, $count])->all());
        $this->info('Legacy guide records were preserved.');

        return self::SUCCESS;
    }

    private function upsertDriverForGuide(Guide $guide, bool $force): array
    {
        $driver = Driver::where('phone', $guide->phone)
            ->when($guide->email, fn ($query) => $query->orWhere('email', $guide->email))
            ->first();

        $created = false;

        if (! $driver) {
            $driver = new Driver;
            $created = true;
        }

        $attributes = $this->driverAttributes($guide, $driver, $created || $force);
        $driver->fill($attributes);
        $driver->save();

        return [$driver, $created];
    }

    private function driverAttributes(Guide $guide, Driver $driver, bool $overwrite): array
    {
        return [
            'name' => $this->value($guide->name, $driver->name, $overwrite),
            'email' => $this->value($guide->email, $driver->email, $overwrite),
            'phone' => $this->value($guide->phone, $driver->phone, $overwrite),
            'password' => $this->value($guide->password, $driver->password, $overwrite),
            'profile_photo' => $this->value($guide->profile_photo, $driver->profile_photo, $overwrite),
            'date_of_birth' => $this->value($guide->date_of_birth, $driver->date_of_birth, $overwrite),
            'gender' => $this->value($guide->gender, $driver->gender, $overwrite),
            'status' => $this->value($guide->status, $driver->status, $overwrite),
            'is_active' => $this->value($guide->is_active, $driver->is_active, $overwrite),
            'is_approved' => $this->value($guide->is_approved, $driver->is_approved, $overwrite),
            'approved_at' => $this->value($guide->approved_at, $driver->approved_at, $overwrite),
            'approved_by' => $this->value($guide->approved_by, $driver->approved_by, $overwrite),
            'rating' => $this->value($guide->rating, $driver->rating, $overwrite),
            'total_tours' => max((int) $guide->total_tours, (int) $driver->total_tours),
            'can_tour_lead' => true,
            'can_tour_transport' => true,
            'languages' => $this->mergedArray($driver->languages, $guide->languages, $overwrite),
            'expertise_tags' => $this->mergedArray($driver->expertise_tags, $guide->specializations, $overwrite),
            'certification_notes' => $this->certificationNotes($guide, $driver, $overwrite),
            'bank_account_number' => $this->value($guide->bank_account_number, $driver->bank_account_number, $overwrite),
            'bank_account_name' => $this->value($guide->bank_account_name, $driver->bank_account_name, $overwrite),
            'bank_name' => $this->value($guide->bank_name, $driver->bank_name, $overwrite),
            'ifsc_code' => $this->value($guide->ifsc_code, $driver->ifsc_code, $overwrite),
            'phone_verified_at' => $this->value($guide->phone_verified_at, $driver->phone_verified_at, $overwrite),
        ];
    }

    private function value(mixed $incoming, mixed $current, bool $overwrite): mixed
    {
        if ($overwrite || blank($current)) {
            return $incoming;
        }

        return $current;
    }

    private function mergedArray(mixed $current, mixed $incoming, bool $overwrite): array
    {
        $currentItems = Collection::wrap($current)->filter()->values();
        $incomingItems = Collection::wrap($incoming)->filter()->values();

        if ($overwrite) {
            return $incomingItems->unique()->values()->all();
        }

        return $currentItems->merge($incomingItems)->unique()->values()->all();
    }

    private function certificationNotes(Guide $guide, Driver $driver, bool $overwrite): string
    {
        $notes = collect([
            "Migrated from legacy guide #{$guide->id}.",
            $guide->bio ? "Bio: {$guide->bio}" : null,
            "Experience years: {$guide->experience_years}.",
            $guide->certification_number ? "Certification number: {$guide->certification_number}." : null,
            $guide->certification_expiry ? "Certification expiry: {$guide->certification_expiry->toDateString()}." : null,
        ])->filter()->implode(PHP_EOL);

        if ($overwrite || blank($driver->certification_notes)) {
            return $notes;
        }

        if (str_contains($driver->certification_notes, "legacy guide #{$guide->id}")) {
            return $driver->certification_notes;
        }

        return $driver->certification_notes.PHP_EOL.PHP_EOL.$notes;
    }

    private function syncAssignments(Guide $guide, Driver $driver): array
    {
        $synced = 0;
        $skipped = 0;

        TourGuideAssignment::where('guide_id', $guide->id)->each(function (TourGuideAssignment $assignment) use ($driver, &$synced, &$skipped): void {
            $driverAssignment = TourDriverAssignment::firstOrCreate(
                [
                    'tour_schedule_id' => $assignment->tour_schedule_id,
                    'driver_id' => $driver->id,
                ],
                [
                    'role' => $assignment->role,
                    'status' => $assignment->status,
                    'fee' => $assignment->fee,
                    'notes' => $this->assignmentNotes($assignment),
                ]
            );

            $driverAssignment->wasRecentlyCreated ? $synced++ : $skipped++;
        });

        return [$synced, $skipped];
    }

    private function assignmentNotes(TourGuideAssignment $assignment): string
    {
        return trim(collect([
            "Migrated from legacy guide assignment #{$assignment->id}.",
            $assignment->notes,
        ])->filter()->implode(PHP_EOL));
    }
}

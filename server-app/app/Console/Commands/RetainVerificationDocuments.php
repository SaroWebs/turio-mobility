<?php

namespace App\Console\Commands;

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\DriverDocumentVersion;
use App\Services\Verification\DocumentWorkflow;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class RetainVerificationDocuments extends Command
{
    protected $signature = 'verification:retention {--execute : Purge eligible superseded files under the configured retention policy}';

    protected $description = 'Dry-run or execute retention of superseded private document files; retain audit metadata';

    public function handle(DocumentWorkflow $workflow): int
    {
        $days = config('document_verification.retention_days');
        if (! is_numeric($days) || (int) $days < 1) {
            $this->error('Set VERIFICATION_RETENTION_DAYS to an approved positive retention period before running.');

            return self::FAILURE;
        }
        $eligible = 0;
        DriverDocumentVersion::where('storage_disk', 'local')->whereNull('purged_at')->where('legal_hold', false)
            ->where('created_at', '<', now()->subDays((int) $days))->chunkById(100, function ($versions) use (&$eligible, $workflow) {
                foreach ($versions as $version) {
                    DB::transaction(function () use ($version, &$eligible, $workflow) {
                        $document = DriverDocument::findOrFail($version->driver_document_id);
                        Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
                        $document = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
                        $current = DriverDocumentVersion::whereKey($version->id)->lockForUpdate()->firstOrFail();
                        if ($current->legal_hold || $current->purged_at || $current->version >= $document->version
                            || DB::table('verification_appeals')->where('driver_document_id', $document->id)->where('status', 'pending')->exists()
                            || DriverDocument::where('file_path', $current->file_path)->exists()
                            || DriverDocumentVersion::where('file_path', $current->file_path)->where('id', '!=', $current->id)->whereNull('purged_at')->exists()) {
                            return;
                        }
                        $eligible++;
                        if (! $this->option('execute')) {
                            return;
                        }
                        if (! str_starts_with($current->file_path, 'driver-documents/') || str_contains($current->file_path, '..')) {
                            throw new \RuntimeException('Unexpected private file path.');
                        }
                        // Missing file is acceptable on a retry after deletion but before metadata commit.
                        if (Storage::disk('local')->exists($current->file_path) && ! Storage::disk('local')->delete($current->file_path)) {
                            throw new \RuntimeException('Private file deletion failed.');
                        }
                        DB::table('driver_document_versions')->where('id', $current->id)->update(['purged_at' => now(), 'encrypted_number' => null]);
                        $document->version = $current->version;
                        $workflow->audit($document, null, 'retention_purge', $document->status, 'Superseded file purged under configured retention policy; audit metadata retained.');
                    });
                }
            });
        $this->info(($this->option('execute') ? 'Purged' : 'Eligible (dry run)').': '.$eligible.' superseded versions.');

        return self::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Services\Verification\DocumentWorkflow;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PrivatizeDriverDocuments extends Command
{
    protected $signature = 'verification:privatize {--execute : Copy legacy current documents to private storage and reset them for review} {--remove-public : Remove public originals after verified private copy; requires execute}';

    protected $description = 'Plan or execute the reviewed migration of legacy public driver documents';

    public function handle(DocumentWorkflow $workflow): int
    {
        if ($this->option('remove-public') && ! $this->option('execute')) {
            $this->error('--remove-public requires --execute.');

            return self::FAILURE;
        }
        $count = DriverDocument::where('storage_disk', 'public')->count();
        $this->info("{$count} current public documents require private migration and fresh review.");
        $this->info(\App\Models\DriverDocumentVersion::where('storage_disk', 'public')->count().' historical public versions require migration.');
        if (! $this->option('execute')) {
            $this->warn('Dry run. Execution resets current documents to pending and may block driver operations. Public-file removal must be separately authorized.');

            return self::SUCCESS;
        }
        $failed = 0;
        DriverDocument::where('storage_disk', 'public')->chunkById(100, function ($documents) use ($workflow, &$failed) {
            foreach ($documents as $document) {
                $copied = null;
                $committed = false;
                try {
                    $oldPath = DB::transaction(function () use ($document, $workflow, &$copied) {
                        Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
                        $current = DriverDocument::whereKey($document->id)->lockForUpdate()->firstOrFail();
                        if ($current->storage_disk !== 'public') {
                            return null;
                        }
                        $old = $current->file_path;
                        if (! str_starts_with($old, 'driver-documents/') || str_contains($old, '..') || ! Storage::disk('public')->exists($old)) {
                            throw new \RuntimeException('Missing file or unexpected legacy path.');
                        }
                        $bytes = Storage::disk('public')->get($old);
                        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
                        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], true)) {
                            throw new \RuntimeException('Legacy file type requires independent review.');
                        }
                        $copied = 'driver-documents/'.$current->driver_id.'/'.Str::uuid();
                        if (! Storage::disk('local')->put($copied, $bytes) || hash('sha256', Storage::disk('local')->get($copied)) !== hash('sha256', $bytes)) {
                            throw new \RuntimeException('Private copy verification failed.');
                        }
                        $from = $current->status;
                        $current->fill(['storage_disk' => 'local', 'file_path' => $copied, 'version' => max(1, $current->version + 1),
                            'encrypted_number' => $current->type === 'government_id' ? null : ($current->encrypted_number ?: $current->document_number),
                            'document_number' => null, 'checksum' => hash('sha256', $bytes), 'status' => 'pending', 'verification_outcome' => 'unverified',
                            'reviewed_at' => null, 'reviewed_by' => null])->save();
                        $version = $current->versions()->create(['version' => $current->version, 'file_path' => $copied, 'storage_disk' => 'local', 'checksum' => $current->checksum,
                            'mime_type' => $mime, 'encrypted_number' => $current->encrypted_number, 'expires_at' => $current->expires_at, 'created_at' => now()]);
                        $this->recordMove($version->id, $old, $copied, $current->checksum);
                        $workflow->audit($current, null, 'private_migration', $from, 'Legacy document copied to private storage; fresh evidence and review required.');

                        return $old;
                    });
                    $committed = true;
                } catch (\Throwable $error) {
                    if ($copied && ! $committed) {
                        Storage::disk('local')->delete($copied);
                    }
                    $failed++;
                    $this->error('Document #'.$document->id.': migration failed; inspect privately before retrying.');
                }
            }
        });
        \App\Models\DriverDocumentVersion::where('storage_disk', 'public')->chunkById(100, function ($versions) use ($workflow, &$failed) {
            foreach ($versions as $version) {
                $copied = null;
                try {
                    DB::transaction(function () use ($version, $workflow, &$copied) {
                        $document = DriverDocument::findOrFail($version->driver_document_id);
                        Driver::whereKey($document->driver_id)->lockForUpdate()->firstOrFail();
                        $current = \App\Models\DriverDocumentVersion::whereKey($version->id)->lockForUpdate()->firstOrFail();
                        if ($current->storage_disk !== 'public') {
                            return;
                        }
                        $old = $current->file_path;
                        if (! str_starts_with($old, 'driver-documents/') || str_contains($old, '..') || ! Storage::disk('public')->exists($old)) {
                            throw new \RuntimeException('Historical source is missing or invalid.');
                        }
                        $bytes = Storage::disk('public')->get($old);
                        $checksum = hash('sha256', $bytes);
                        if ($current->checksum && ! hash_equals($current->checksum, $checksum)) {
                            throw new \RuntimeException('Historical source checksum changed.');
                        }
                        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
                        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], true)) {
                            throw new \RuntimeException('Unsupported historical file.');
                        }
                        $copied = 'driver-documents/'.$document->driver_id.'/'.Str::uuid();
                        if (! Storage::disk('local')->put($copied, $bytes) || hash('sha256', Storage::disk('local')->get($copied)) !== $checksum) {
                            throw new \RuntimeException('Historical copy verification failed.');
                        }
                        // Authorized storage relocation preserves the immutable version and evidence content.
                        DB::table('driver_document_versions')->where('id', $current->id)->update(['file_path' => $copied, 'storage_disk' => 'local', 'checksum' => $checksum, 'mime_type' => $mime]);
                        $this->recordMove($current->id, $old, $copied, $checksum);
                        $document->version = $current->version;
                        $workflow->audit($document, null, 'historical_private_migration', $document->status, 'Historical version relocated with verified checksum; evidence content unchanged.');
                    });
                } catch (\Throwable) {
                    if ($copied) {
                        Storage::disk('local')->delete($copied);
                    }
                    $failed++;
                    $this->error('Historical version #'.$version->id.' migration failed.');
                }
            }
        });
        if ($this->option('remove-public')) {
            DB::table('verification_file_moves')->whereNull('source_removed_at')->orderBy('id')->chunkById(100, function ($moves) use (&$failed) {
                foreach ($moves as $move) {
                    try {
                        $source = \Illuminate\Support\Facades\Crypt::decryptString($move->source_path);
                        if (! str_starts_with($source, 'driver-documents/') || str_contains($source, '..')
                            || DriverDocument::where('storage_disk', 'public')->where('file_path', $source)->exists()
                            || \App\Models\DriverDocumentVersion::where('storage_disk', 'public')->where('file_path', $source)->exists()
                            || ! Storage::disk('local')->exists($move->destination_path)
                            || hash('sha256', Storage::disk('local')->get($move->destination_path)) !== $move->checksum) {
                            throw new \RuntimeException('Source still referenced or private checksum unavailable.');
                        }
                        if (Storage::disk('public')->exists($source)) {
                            if (hash('sha256', Storage::disk('public')->get($source)) !== $move->checksum || ! Storage::disk('public')->delete($source)) {
                                throw new \RuntimeException('Public removal failed or source changed.');
                            }
                        }
                        DB::table('verification_file_moves')->where('id', $move->id)->update(['source_removed_at' => now()]);
                    } catch (\Throwable) {
                        $failed++;
                        $this->error('File move #'.$move->id.' public removal requires review.');
                    }
                }
            });
        }
        $this->info('Migration finished; failures: '.$failed.'.');

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    private function recordMove(int $version, string $source, string $destination, string $checksum): void
    {
        DB::table('verification_file_moves')->insert(['version_id' => $version, 'source_path' => \Illuminate\Support\Facades\Crypt::encryptString($source), 'destination_path' => $destination, 'checksum' => $checksum, 'created_at' => now()]);
    }
}

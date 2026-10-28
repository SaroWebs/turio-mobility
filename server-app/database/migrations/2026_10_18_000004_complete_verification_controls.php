<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_verification_attempts', function (Blueprint $table) {
            if (! Schema::hasColumn('document_verification_attempts', 'version')) {
                $table->unsignedInteger('version')->default(0);
            }
            if (! Schema::hasColumn('document_verification_attempts', 'attributes')) {
                $table->text('attributes')->nullable();
            }
            if (! Schema::hasColumn('document_verification_attempts', 'error_code')) {
                $table->string('error_code')->nullable();
            }
        });
        Schema::table('driver_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('driver_documents', 'requires_second_review')) {
                $table->boolean('requires_second_review')->default(false);
            }
            if (! Schema::hasColumn('driver_documents', 'approved_subject_hash')) {
                $table->string('approved_subject_hash', 64)->nullable();
            }
            if (! Schema::hasColumn('driver_documents', 'evidence_subject_hash')) {
                $table->string('evidence_subject_hash', 64)->nullable();
            }
        });
        Schema::table('document_requirements', function (Blueprint $table) {
            if (Schema::hasIndex('document_requirements', 'document_requirements_type_service_category_unique')) {
                $table->dropUnique(['type', 'service_category']);
            }
            if (! Schema::hasColumn('document_requirements', 'scope_key')) {
                $table->string('scope_key', 40)->default('all');
            }
            if (! Schema::hasColumn('document_requirements', 'vehicle_category_id')) {
                $table->foreignId('vehicle_category_id')->nullable()->constrained('car_categories')->restrictOnDelete();
            }
            if (! Schema::hasColumn('document_requirements', 'alternative_types')) {
                $table->json('alternative_types')->nullable();
            }
            if (! Schema::hasColumn('document_requirements', 'licence_class')) {
                $table->string('licence_class', 40)->nullable();
            }
            if (! Schema::hasColumn('document_requirements', 'licence_scope')) {
                $table->string('licence_scope', 20)->nullable();
            }
            if (! Schema::hasColumn('document_requirements', 'second_review')) {
                $table->boolean('second_review')->default(false);
            }
            if (! Schema::hasIndex('document_requirements', 'document_requirements_scope_unique')) {
                $table->unique(['type', 'service_category', 'scope_key'], 'document_requirements_scope_unique');
            }
        });
        Schema::table('driver_document_versions', function (Blueprint $table) {
            if (! Schema::hasColumn('driver_document_versions', 'purged_at')) {
                $table->timestamp('purged_at')->nullable();
            }
            if (! Schema::hasColumn('driver_document_versions', 'legal_hold')) {
                $table->boolean('legal_hold')->default(false);
            }
        });
        // MySQL commits DDL before an index failure. Preserve existing rows and resume safely.
        if (! Schema::hasTable('verification_findings')) {
            Schema::create('verification_findings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('driver_document_id')->constrained()->restrictOnDelete();
                $table->unsignedInteger('version');
                $table->foreignId('attempt_id')->nullable()->constrained('document_verification_attempts')->restrictOnDelete();
                $table->string('code');
                $table->string('severity');
                $table->boolean('blocking')->default(true);
                $table->boolean('non_overridable')->default(false);
                $table->text('message');
                $table->text('resolution_evidence')->nullable();
                $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamp('created_at');
            });
        }
        if (! Schema::hasIndex('verification_findings', ['driver_document_id', 'version', 'resolved_at'])) {
            Schema::table('verification_findings', fn (Blueprint $table) => $table->index(['driver_document_id', 'version', 'resolved_at'], 'vf_document_version_resolved_idx'));
        }
        if (! Schema::hasTable('verification_provider_settings')) {
            Schema::create('verification_provider_settings', function (Blueprint $table) {
                $table->string('provider')->primary();
                $table->boolean('enabled')->default(false);
                $table->string('authorization_reference')->nullable();
                $table->timestamps();
            });
        }
        if (! Schema::hasTable('verification_file_moves')) {
            Schema::create('verification_file_moves', function (Blueprint $table) {
                $table->id();
                $table->foreignId('version_id')->constrained('driver_document_versions')->restrictOnDelete();
                $table->text('source_path');
                $table->string('destination_path');
                $table->string('checksum', 64);
                $table->timestamp('source_removed_at')->nullable();
                $table->timestamp('created_at');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('verification_file_moves');
        Schema::dropIfExists('verification_provider_settings');
        Schema::dropIfExists('verification_findings');
        Schema::table('driver_document_versions', fn (Blueprint $t) => $t->dropColumn(['purged_at', 'legal_hold']));
        Schema::table('document_requirements', function (Blueprint $t) {
            $t->dropUnique('document_requirements_scope_unique');
            $t->dropColumn('scope_key');
            $t->dropConstrainedForeignId('vehicle_category_id');
            $t->dropColumn(['alternative_types', 'licence_class', 'licence_scope', 'second_review']);
        });
        Schema::table('driver_documents', fn (Blueprint $t) => $t->dropColumn(['requires_second_review', 'approved_subject_hash', 'evidence_subject_hash']));
        Schema::table('document_verification_attempts', fn (Blueprint $t) => $t->dropColumn(['version', 'attributes', 'error_code']));
    }
};

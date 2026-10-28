<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class VerificationPermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['view', 'review', 'run_api', 'manual_check', 'request_correction', 'approve_document', 'reject_document', 'approve_driver', 'escalate', 'resolve_appeal', 'manage_providers', 'manage_requirements', 'view_audit_logs', 'second_review', 'resolve_finding', 'manage_retention'] as $action) {
            $permission = Permission::firstOrCreate(['name' => 'verification.'.$action], [
                'display_name' => 'Verification: '.str_replace('_', ' ', $action), 'group' => 'verification',
            ]);
            foreach (Role::whereIn('name', ['admin', 'super_admin'])->get() as $role) {
                $role->permissions()->syncWithoutDetaching([$permission->id]);
            }
        }
    }
}

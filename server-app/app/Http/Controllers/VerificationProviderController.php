<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class VerificationProviderController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasPermission('verification.manage_providers'), 403);

        return Inertia::render('admin/Verification/Providers', [
            'setting' => DB::table('verification_provider_settings')->where('provider', 'eko')->first(),
            'credentials_present' => collect(['developer_key', 'access_key', 'initiator_id'])->every(fn ($key) => filled(config('document_verification.eko.'.$key))),
            'environment_enabled' => (bool) config('document_verification.eko.enabled'),
            'production' => (bool) config('document_verification.eko.production'),
            'recent' => \App\Models\DocumentVerificationAttempt::where('provider', 'eko')->latest('id')->limit(20)->get(['id', 'status', 'error_code', 'duration_ms', 'created_at']),
        ]);
    }

    public function update(Request $request)
    {
        abort_unless($request->user()->hasPermission('verification.manage_providers'), 403);
        $data = $request->validate(['enabled' => ['required', 'boolean'], 'authorization_reference' => ['required_if:enabled,true', 'nullable', 'string', 'max:300'], 'reason' => ['required', 'string', 'max:2000']]);
        if ($data['enabled']) {
            abort_unless(config('document_verification.eko.enabled') && collect(['developer_key', 'access_key', 'initiator_id'])->every(fn ($key) => filled(config('document_verification.eko.'.$key))), 422, 'Configure the provider credentials and environment switch before enabling requests.');
        }
        DB::transaction(function () use ($request, $data) {
            DB::table('verification_provider_settings')->updateOrInsert(['provider' => 'eko'], ['enabled' => $data['enabled'], 'authorization_reference' => $data['authorization_reference'], 'created_at' => now(), 'updated_at' => now()]);
            DB::table('verification_policy_events')->insert(['actor_id' => $request->user()->id, 'action' => 'provider_configuration', 'subject' => 'eko', 'reason' => $data['reason'], 'details' => json_encode(['enabled' => $data['enabled'], 'authorization_reference' => $data['authorization_reference']]), 'created_at' => now()]);
        });

        return back()->with('success', 'Provider configuration saved.');
    }
}

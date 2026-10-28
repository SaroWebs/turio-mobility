<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServiceZone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ServiceZoneController extends Controller
{
    public function index()
    {
        return inertia('admin/ServiceZones/Index', [
            'title' => 'Service Zones',
            'zones' => ServiceZone::query()->orderByDesc('priority')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        ServiceZone::create($this->validated($request));

        return back()->with('success', 'Service zone created.');
    }

    public function update(Request $request, ServiceZone $serviceZone): RedirectResponse
    {
        $serviceZone->update($this->validated($request));

        return back()->with('success', 'Service zone updated.');
    }

    public function destroy(ServiceZone $serviceZone): RedirectResponse
    {
        $serviceZone->delete();

        return back()->with('success', 'Service zone deleted.');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'center_lat' => ['required', 'numeric', 'between:-90,90'],
            'center_lng' => ['required', 'numeric', 'between:-180,180'],
            'radius_km' => ['required', 'numeric', 'min:0.1', 'max:1000'],
            'priority' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}

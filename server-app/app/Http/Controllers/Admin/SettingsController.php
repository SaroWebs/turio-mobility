<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CarCategory;
use App\Models\ServiceZone;
use App\Models\Setting;
use App\Support\Settings\SettingsCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SettingsController extends Controller
{
    public function index(SettingsCatalog $catalog)
    {
        return inertia('admin/Settings/Index', [
            'title' => 'Operational Settings',
            'catalog' => $catalog->all(),
            'groups' => $catalog->groups(),
            'overrides' => Setting::query()->get(),
            'categories' => CarCategory::query()->orderBy('name')->get(['id', 'name']),
            'zones' => ServiceZone::query()->orderByDesc('priority')->orderBy('name')->get(),
        ]);
    }

    public function update(Request $request, SettingsCatalog $catalog): RedirectResponse
    {
        $values = $request->input('values', []);
        if (! is_array($values)) {
            return back()->withErrors(['values' => 'Settings must be submitted as an object.']);
        }

        $categoryId = $request->input('scope_category_id');
        $zoneId = $request->input('scope_zone_id');

        foreach ($values as $key => $value) {
            $definition = $catalog->get((string) $key);
            if (! $definition) {
                return back()->withErrors(["values.{$key}" => 'Unknown setting.']);
            }

            $scope = [];
            $scope['scope_category_id'] = $categoryId !== null && in_array('category', $definition['scopes'], true)
                ? (int) $categoryId
                : null;
            $scope['scope_zone_id'] = $zoneId !== null && in_array('zone', $definition['scopes'], true)
                ? (int) $zoneId
                : null;

            $rules = $catalog->rules([(string) $key])[(string) $key] ?? ['required'];
            $validator = Validator::make(['setting_value' => $value], ['setting_value' => $rules]);
            if ($validator->fails()) {
                return back()->withErrors(["values.{$key}" => $validator->errors()->first('setting_value')]);
            }

            Setting::updateOrCreate(
                array_merge(['key' => (string) $key], $scope),
                ['value' => $value]
            );
        }

        return back()->with('success', 'Operational settings updated.');
    }
}

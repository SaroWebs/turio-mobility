<?php

namespace App\Http\Controllers;

use App\Models\CmsContent;
use App\Rules\FileIsClean;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class AdminCmsController extends Controller
{
    public function index(Request $request)
    {
        $app = trim((string) $request->input('app'));

        return inertia('admin/Cms/Index', [
            'title' => 'Frontend CMS',
            'contents' => CmsContent::query()
                ->when($app !== '', fn ($query) => $query->where('app', $app))
                ->orderBy('app')
                ->orderBy('page')
                ->orderBy('sort_order')
                ->orderBy('section')
                ->paginate(30)
                ->withQueryString(),
            'apps' => CmsContent::apps(),
            'filters' => ['app' => $app],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateContent($request);
        $validated['value'] = $this->contentValue($request, $validated);

        CmsContent::create($validated);

        return back()->with('success', 'CMS content created.');
    }

    public function update(Request $request, CmsContent $cmsContent)
    {
        $validated = $this->validateContent($request, $cmsContent);
        $oldValue = $cmsContent->value;
        $validated['value'] = $this->contentValue($request, $validated, $oldValue);
        $cmsContent->update($validated);

        if ($request->hasFile('image')) {
            $this->deleteStoredMedia($oldValue);
        }

        return back()->with('success', 'CMS content updated.');
    }

    public function destroy(CmsContent $cmsContent)
    {
        $this->deleteStoredMedia($cmsContent->type === 'image' ? $cmsContent->value : null);
        $cmsContent->delete();

        return back()->with('success', 'CMS content removed.');
    }

    private function validateContent(Request $request, ?CmsContent $content = null): array
    {
        return $request->validate([
            'app' => ['required', 'string', 'max:60', 'regex:/^[a-z0-9-]+$/'],
            'page' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/'],
            'section' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/'],
            'key' => [
                'required',
                'string',
                'max:100',
                'regex:/^[a-z0-9-_]+$/',
                Rule::unique('cms_contents')->where(fn ($query) => $query
                    ->where('app', $request->input('app'))
                    ->where('page', $request->input('page'))
                    ->where('section', $request->input('section')))
                    ->ignore($content?->id),
            ],
            'type' => ['required', Rule::in(['text', 'image', 'url', 'json'])],
            'value' => [
                Rule::requiredIf(fn () => ! $request->hasFile('image') && ! filled($content?->value)),
                Rule::when($request->input('type') === 'json', ['json']),
                'nullable',
                'string',
                'max:20000',
            ],
            'image' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp,svg', 'max:10240', new FileIsClean],
            'metadata' => ['nullable', 'array'],
            'sort_order' => ['required', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
        ]);
    }

    private function contentValue(Request $request, array $validated, ?string $fallback = null): ?string
    {
        if ($request->hasFile('image')) {
            return $request->file('image')->store('cms', 'public');
        }

        $value = $validated['value'] ?? $fallback;

        return $value;
    }

    private function deleteStoredMedia(?string $path): void
    {
        if (filled($path) && ! MediaUrl::isExternal($path)) {
            Storage::disk('public')->delete(ltrim(str_replace('storage/', '', $path), '/'));
        }
    }
}

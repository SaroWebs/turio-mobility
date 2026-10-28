<?php

namespace App\Http\Controllers;

use App\Models\Tour;
use App\Rules\FileIsClean;
use App\Services\TourBrochureService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TourBrochureController extends Controller
{
    public function publicDownload(Request $request, Tour $tour, TourBrochureService $brochures)
    {
        abort_unless($tour->is_active
            && (! $tour->available_from || $tour->available_from->lte(now()))
            && (! $tour->available_to || $tour->available_to->gte(today())), 404);

        return $this->download($request, $tour, $brochures);
    }

    // Protected by the same admin middleware as tour management.
    public function download(Request $request, Tour $tour, TourBrochureService $brochures)
    {
        $input = $request->validate(['source' => ['nullable', Rule::in(['generated', 'uploaded'])]]);
        $source = $input['source'] ?? null;
        $filename = (Str::slug($tour->title) ?: 'tour-'.$tour->id).'-brochure.pdf';
        $headers = ['Content-Type' => 'application/pdf', 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store'];

        if ($source !== 'generated' && $tour->brochure_path && Storage::disk('local')->exists($tour->brochure_path)) {
            return Storage::disk('local')->download($tour->brochure_path, $filename, $headers);
        }
        abort_if($source === 'uploaded', 404, 'No uploaded brochure is available.');

        return response($brochures->generate($tour), 200, [
            ...$headers,
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function upload(Request $request, Tour $tour)
    {
        $request->validate(['brochure' => ['required', 'file', 'mimes:pdf', 'max:20480', new FileIsClean]]);
        $file = $request->file('brochure');
        $path = $file->store('tour-brochures/uploads/'.$tour->id, 'local');
        abort_unless($path, 500, 'The brochure could not be stored. Please try again.');
        try {
            $oldPath = DB::transaction(function () use ($tour, $file, $path) {
                $locked = Tour::lockForUpdate()->findOrFail($tour->id);
                $oldPath = $locked->brochure_path;
                $locked->forceFill([
                    'brochure_path' => $path,
                    'brochure_name' => Str::limit(basename($file->getClientOriginalName()), 250, ''),
                    'brochure_uploaded_at' => now(),
                ])->save();

                return $oldPath;
            });
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($path);
            throw $error;
        }
        if ($oldPath) {
            Storage::disk('local')->delete($oldPath);
        }

        return back()->with('success', 'Brochure uploaded. Customers will receive this PDF by default.');
    }

    public function remove(Tour $tour)
    {
        $oldPath = DB::transaction(function () use ($tour) {
            $locked = Tour::lockForUpdate()->findOrFail($tour->id);
            $oldPath = $locked->brochure_path;
            $locked->forceFill(['brochure_path' => null, 'brochure_name' => null, 'brochure_uploaded_at' => null])->save();

            return $oldPath;
        });
        if ($oldPath) {
            Storage::disk('local')->delete($oldPath);
        }

        return back()->with('success', 'Uploaded brochure removed. The generated brochure remains available.');
    }
}

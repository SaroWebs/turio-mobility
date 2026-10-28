<?php

namespace App\Services;

use App\Models\Tour;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\File;

class TourBrochureService
{
    public function generate(Tour $tour): string
    {
        // Reload public content: admin-loaded booking/assignment relations never enter the PDF.
        $tour->load(['category', 'itineraries']);
        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isJavascriptEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');
        $cachePath = storage_path('framework/cache/tour-brochures');
        File::ensureDirectoryExists($cachePath);
        $options->set('fontCache', $cachePath);
        $options->set('tempDir', $cachePath);
        $options->set('chroot', resource_path('views/brochures'));
        $pdf = new Dompdf($options);
        $pdf->setPaper('A4');
        $pdf->loadHtml(view('brochures.tour', [
            'tour' => $tour,
            'days' => $tour->itineraries->groupBy('day_number'),
            'generatedAt' => now(),
        ])->render(), 'UTF-8');
        $pdf->render();
        $font = $pdf->getFontMetrics()->getFont('DejaVu Sans');
        $pdf->getCanvas()->page_text(475, 807, '{PAGE_NUM} / {PAGE_COUNT}', $font, 8, [0.35, 0.41, 0.39]);

        return $pdf->output();
    }
}

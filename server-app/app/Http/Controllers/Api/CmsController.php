<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CmsContent;

class CmsController extends Controller
{
    public function show(string $app)
    {
        abort_unless(preg_match('/^[a-z0-9-]+$/', $app) === 1, 404);

        return response()->json([
            'success' => true,
            'data' => CmsContent::publishedPayload($app),
        ])->setPublic()->setMaxAge(300);
    }
}

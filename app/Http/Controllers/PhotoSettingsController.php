<?php

namespace App\Http\Controllers;

use App\Support\PhotoRetention;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Días que se conservan las fotos de contadores de los cortes.
 */
class PhotoSettingsController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'days' => ['required', 'integer', 'min:'.PhotoRetention::MIN_DAYS, 'max:'.PhotoRetention::MAX_DAYS],
        ], [
            'days.min' => 'Las fotos deben conservarse al menos '.PhotoRetention::MIN_DAYS.' días.',
            'days.max' => 'Las fotos pueden conservarse como máximo '.PhotoRetention::MAX_DAYS.' días (5 años).',
        ], [
            'days' => 'días',
        ]);

        $retention = PhotoRetention::save((int) $data['days']);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Las fotos de contadores se conservarán {$retention->days} días.",
        ]);

        return back();
    }
}

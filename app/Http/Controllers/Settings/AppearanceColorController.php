<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Color de la interfaz elegido por el usuario (vacío = color de la empresa).
 */
class AppearanceColorController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'accent_color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ], [
            'accent_color.regex' => 'Elija un color válido.',
        ]);

        $request->user()->update([
            'accent_color' => isset($data['accent_color']) ? strtolower($data['accent_color']) : null,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Color actualizado.']);

        return back();
    }
}

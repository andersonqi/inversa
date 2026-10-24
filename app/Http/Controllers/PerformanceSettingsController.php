<?php

namespace App\Http\Controllers;

use App\Support\Money;
use App\Support\PerformanceThresholds;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Montos semanales con que se clasifica el rendimiento de las máquinas.
 */
class PerformanceSettingsController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'excellent' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'poor' => ['required', 'numeric', 'min:0', 'lt:excellent'],
        ], [
            'poor.lt' => 'El monto de "Insuficiente" debe ser menor que el de "Excelente".',
        ], [
            'excellent' => 'monto de Excelente',
            'poor' => 'monto de Insuficiente',
        ]);

        $thresholds = PerformanceThresholds::save((float) $data['excellent'], (float) $data['poor']);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Clasificación actualizada: Excelente desde '.Money::format($thresholds->excellent).' por semana; Insuficiente debajo de '.Money::format($thresholds->poor).'.',
        ]);

        return back();
    }
}

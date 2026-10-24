<?php

namespace App\Http\Controllers;

use App\Services\ExchangeRateService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use RuntimeException;

class ExchangeRateController extends Controller
{
    /**
     * Consulta en el momento el tipo de cambio (botón "Actualizar" de la cabecera).
     */
    public function refresh(ExchangeRateService $service): RedirectResponse
    {
        try {
            $rate = $service->refresh();
        } catch (RuntimeException) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'No se pudo consultar el tipo de cambio; se mantiene el último disponible.']);

            return back();
        }

        $value = number_format((float) $rate->rate, 4);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Tipo de cambio actualizado: 1 US$ = Q{$value} ({$rate->source})."]);

        return back();
    }
}

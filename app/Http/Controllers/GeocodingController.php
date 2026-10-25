<?php

namespace App\Http\Controllers;

use App\Services\GeocodingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Dirección, ciudad y distrito de la coordenada tomada con el GPS del teléfono (para
 * llenar la ubicación del cliente). Solo para quien edita clientes o registra cortes.
 */
class GeocodingController extends Controller
{
    public function reverse(Request $request, GeocodingService $geocoding): JsonResponse
    {
        abort_unless($request->user()->canAny(['clients.manage', 'collections.create']), 403);

        $data = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $place = $geocoding->reverse((float) $data['latitude'], (float) $data['longitude']);

        return response()->json([
            'found' => $place !== null,
            'address' => $place['address'] ?? null,
            'city' => $place['city'] ?? null,
            'district' => $place['district'] ?? null,
        ]);
    }
}

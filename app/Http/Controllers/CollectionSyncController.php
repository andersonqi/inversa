<?php

namespace App\Http\Controllers;

use App\Enums\MachineStatus;
use App\Http\Requests\SyncCollectionRequest;
use App\Models\Client;
use App\Services\CollectionSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Modo sin conexión: pantalla de trabajo offline, descarga de los datos de la ruta al
 * teléfono y sincronización de los cortes guardados sin señal.
 */
class CollectionSyncController extends Controller
{
    public function __construct(private CollectionSyncService $sync) {}

    /**
     * Pantalla que el service worker guarda para abrirla sin señal; los datos salen del teléfono.
     */
    public function page(): Response
    {
        return Inertia::render('offline');
    }

    /**
     * Clientes activos con sus máquinas instaladas, contadores y préstamos activos.
     */
    public function data(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user_id' => $user->id,
            'generated_at' => now()->toIso8601String(),
            'today' => now()->toDateString(),
            'clients' => Client::query()
                ->visibleTo($user)
                ->where('is_active', true)
                ->whereHas('machines', fn ($q) => $q->where('status', MachineStatus::Installed))
                ->with([
                    'collectionRoute:id,code,name',
                    'machines' => fn ($q) => $q->where('status', MachineStatus::Installed)->orderBy('code'),
                    'activeLoans:id,client_id,balance,installment_amount,frequency',
                ])
                ->orderBy('collection_route_id')
                ->orderBy('visit_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(SyncCollectionRequest $request): JsonResponse
    {
        $client = Client::query()->visibleTo($request->user())->find($request->integer('client_id'));

        if (! $client) {
            return response()->json([
                'status' => 'error',
                'message' => 'El cliente ya no está en su ruta.',
            ], 422);
        }

        $result = $this->sync->sync($request->user(), $client, $request->validated());

        if ($result['status'] === 'conflict') {
            return response()->json(['status' => 'conflict', ...$result['conflict']], 409);
        }

        $collection = $result['collection'];

        return response()->json([
            'status' => $result['status'],
            'collection_id' => $collection->id,
            'receipt_url' => route('collections.receipt', $collection),
        ], $result['status'] === 'created' ? 201 : 200);
    }
}

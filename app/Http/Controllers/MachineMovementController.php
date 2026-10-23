<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Machine;
use App\Services\MachineMovementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Movimientos de máquinas en campo: transferir a otro cliente, enviar a bodega e
 * instalar desde bodega.
 */
class MachineMovementController extends Controller
{
    public function __construct(private MachineMovementService $service) {}

    public function transfer(Request $request, Machine $machine): RedirectResponse
    {
        $this->ensureVisible($request, $machine);

        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            ...$this->counterRules(),
            'reason' => ['required', 'string', 'max:500'],
        ], [], ['reason' => 'motivo']);

        $this->service->transfer(
            $request->user(),
            $machine,
            $this->destination($request, (int) $data['client_id']),
            (int) $data['counter_in'],
            (int) $data['counter_out'],
            $data['reason'],
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => "Máquina {$machine->code} transferida."]);

        return back();
    }

    public function warehouse(Request $request, Machine $machine): RedirectResponse
    {
        $this->ensureVisible($request, $machine);

        $data = $request->validate([
            ...$this->counterRules(),
            'reason' => ['required', 'string', 'max:500'],
        ], [], ['reason' => 'motivo']);

        $this->service->sendToWarehouse(
            $request->user(),
            $machine,
            (int) $data['counter_in'],
            (int) $data['counter_out'],
            $data['reason'],
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => "Máquina {$machine->code} enviada a bodega."]);

        return back();
    }

    public function install(Request $request, Machine $machine): RedirectResponse
    {
        $this->ensureVisible($request, $machine);

        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            ...$this->counterRules(),
            'reason' => ['nullable', 'string', 'max:500'],
        ], [], ['reason' => 'motivo']);

        $this->service->install(
            $request->user(),
            $machine,
            $this->destination($request, (int) $data['client_id']),
            (int) $data['counter_in'],
            (int) $data['counter_out'],
            $data['reason'] ?? null,
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => "Máquina {$machine->code} instalada."]);

        return back();
    }

    /**
     * @return array<string, list<string>>
     */
    private function counterRules(): array
    {
        return [
            'counter_in' => ['required', 'integer', 'min:0'],
            'counter_out' => ['required', 'integer', 'min:0'],
        ];
    }

    /**
     * Cliente destino activo y dentro del alcance del usuario.
     */
    private function destination(Request $request, int $clientId): Client
    {
        $client = Client::query()
            ->visibleTo($request->user())
            ->where('is_active', true)
            ->with('collectionRoute')
            ->find($clientId);

        if (! $client) {
            throw ValidationException::withMessages(['client_id' => 'Seleccione un cliente activo de su ruta u oficina.']);
        }

        return $client;
    }
}

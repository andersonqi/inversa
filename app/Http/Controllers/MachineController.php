<?php

namespace App\Http\Controllers;

use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Machine;
use App\Services\MachineMovementService;
use App\Services\PhotoStorage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MachineController extends Controller
{
    /**
     * Foto de la máquina: columna => campo del formulario.
     */
    private const PHOTO_FIELDS = ['photo_path' => 'photo'];

    public function __construct(private PhotoStorage $photos) {}

    public function index(Request $request): Response
    {
        $machines = Machine::query()
            ->visibleTo($request->user())
            ->with(['office:id,name', 'client:id,name,collection_route_id', 'client.collectionRoute:id,code'])
            ->when($request->string('search')->value(), fn ($q, $search) => $q->whereAny(['code', 'serial', 'brand', 'model'], 'ilike', "%{$search}%"))
            ->when($request->string('status')->value(), fn ($q, $status) => $q->where('status', $status))
            ->when($request->integer('office_id'), fn ($q, $officeId) => $q->where('office_id', $officeId))
            ->orderBy('code')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('machines/index', [
            'machines' => $machines,
            'filters' => $request->only('search', 'status', 'office_id'),
            'offices' => $this->officeOptions($request->user()),
            'statuses' => MachineStatus::options(),
            // Destinos para "Asignar a cliente" desde bodega.
            'moveClients' => $this->moveClientOptions($request->user()),
        ]);
    }

    public function show(Request $request, Machine $machine): Response
    {
        $this->ensureVisible($request, $machine);

        $machine->load(['office:id,name', 'client:id,name']);

        return Inertia::render('machines/show', [
            'machine' => $machine,
            'statuses' => MachineStatus::options(),
            'readings' => $machine->collectionItems()
                ->with('collection:id,collected_on,client_id,user_id', 'collection.client:id,name', 'collection.user:id,name')
                ->latest('id')
                ->paginate(20)
                ->withQueryString(),
            'totals' => $machine->collectionItems()
                ->selectRaw('count(*) as readings, coalesce(sum(amount_in), 0) as amount_in, coalesce(sum(amount_out), 0) as amount_out, coalesce(sum(net), 0) as net')
                ->first(),
            'movements' => $machine->movements()
                ->with(['user:id,name', 'fromClient:id,name', 'toClient:id,name'])
                ->latest('id')
                ->limit(20)
                ->get(),
            'moveClients' => $this->moveClientOptions($request->user()),
        ]);
    }

    public function photo(Request $request, Machine $machine): StreamedResponse
    {
        $this->ensureVisible($request, $machine);

        return $this->photos->response($machine->photo_path);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('machines/form', $this->formProps($request, null));
    }

    public function store(Request $request, MachineMovementService $movements): RedirectResponse
    {
        $machine = Machine::create($this->validated($request));

        $this->photos->sync($machine, $request, self::PHOTO_FIELDS, "machines/{$machine->id}");

        $movements->logFormChange($request->user(), $machine, null, null);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Máquina registrada.']);

        return to_route('machines.show', $machine);
    }

    public function edit(Request $request, Machine $machine): Response
    {
        $this->ensureVisible($request, $machine);

        return Inertia::render('machines/form', $this->formProps($request, $machine));
    }

    public function update(Request $request, Machine $machine, MachineMovementService $movements): RedirectResponse
    {
        $this->ensureVisible($request, $machine);

        $previousClientId = $machine->client_id;
        $previousStatus = $machine->status;

        $machine->update($this->validated($request, $machine));

        $this->photos->sync($machine, $request, self::PHOTO_FIELDS, "machines/{$machine->id}");

        $movements->logFormChange($request->user(), $machine, $previousClientId, $previousStatus);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Máquina actualizada.']);

        return to_route('machines.show', $machine);
    }

    public function destroy(Request $request, Machine $machine): RedirectResponse
    {
        $this->ensureVisible($request, $machine);

        if ($machine->collectionItems()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'La máquina tiene cortes registrados; márquela como dada de baja.']);

            return back();
        }

        $machine->delete();

        $this->photos->deleteDirectory("machines/{$machine->id}");

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Máquina eliminada.']);

        return to_route('machines.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function formProps(Request $request, ?Machine $machine): array
    {
        return [
            'machine' => $machine,
            'hasReadings' => $machine?->collectionItems()->exists() ?? false,
            'offices' => $this->officeOptions($request->user()),
            'statuses' => MachineStatus::options(),
            'clients' => Client::query()
                ->visibleTo($request->user())
                ->where('is_active', true)
                ->with('collectionRoute:id,code,office_id')
                ->orderBy('name')
                ->get(['id', 'name', 'collection_route_id'])
                ->map(fn (Client $client) => [
                    'id' => $client->id,
                    'name' => "{$client->name} ({$client->collectionRoute->code})",
                    'office_id' => $client->collectionRoute->office_id,
                ]),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Machine $machine = null): array
    {
        $data = $request->validate([
            'office_id' => ['required', 'integer', 'exists:offices,id'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id', 'required_if:status,installed'],
            'code' => ['required', 'string', 'max:30', Rule::unique('machines')->ignore($machine)],
            'serial' => ['nullable', 'string', 'max:60'],
            'brand' => ['nullable', 'string', 'max:60'],
            'model' => ['nullable', 'string', 'max:60'],
            'credit_value' => ['required', 'numeric', 'gt:0'],
            'counter_in' => ['nullable', 'integer', 'min:0'],
            'counter_out' => ['nullable', 'integer', 'min:0'],
            'purchase_cost' => ['nullable', 'numeric', 'min:0'],
            'installed_at' => ['nullable', 'date'],
            'status' => ['required', Rule::enum(MachineStatus::class)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'photo' => PhotoStorage::rules(),
            'remove_photo' => ['sometimes', 'boolean'],
        ], [
            'client_id.required_if' => 'Seleccione el cliente donde se instala la máquina.',
            ...PhotoStorage::messages(['photo']),
        ], [
            'photo' => 'foto de la máquina',
        ]);

        // La foto se guarda aparte (PhotoStorage::sync).
        $data = Arr::except($data, ['photo', 'remove_photo']);

        $this->ensureOfficeAllowed($request->user(), $data['office_id']);

        if ($data['status'] !== MachineStatus::Installed->value) {
            $data['client_id'] = null;
        } else {
            $client = Client::query()->visibleTo($request->user())->with('collectionRoute')->find($request->integer('client_id'));

            if (! $client || $client->collectionRoute->office_id !== (int) $data['office_id']) {
                throw ValidationException::withMessages(['client_id' => 'El cliente debe pertenecer a la oficina de la máquina.']);
            }

            $data['installed_at'] ??= now()->toDateString();
        }

        $hasReadings = $machine?->collectionItems()->exists() ?? false;

        // Con cortes, los cambios de ubicación pasan por las acciones de logística, que
        // verifican que no haya jugadas sin cortar y guardan el historial con motivo.
        if ($machine && $hasReadings && $this->changesLocation($machine, $data)) {
            throw ValidationException::withMessages([
                'status' => 'La máquina tiene cortes: para cambiarla de cliente, enviarla a bodega o instalarla use Transferir, Mover a central o Asignar a cliente en la ficha de la máquina.',
            ]);
        }

        // Una vez que hay cortes, los contadores solo cambian a través de los cortes.
        if ($hasReadings) {
            unset($data['counter_in'], $data['counter_out'], $data['credit_value']);
        } else {
            $data['counter_in'] ??= 0;
            $data['counter_out'] ??= 0;
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function changesLocation(Machine $machine, array $data): bool
    {
        $wasInstalled = $machine->status === MachineStatus::Installed;
        $willInstall = $data['status'] === MachineStatus::Installed->value;

        return $wasInstalled !== $willInstall
            || ($willInstall && (int) $data['client_id'] !== $machine->client_id);
    }
}

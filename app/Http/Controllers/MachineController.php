<?php

namespace App\Http\Controllers;

use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Machine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MachineController extends Controller
{
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
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('machines/form', $this->formProps($request, null));
    }

    public function store(Request $request): RedirectResponse
    {
        $machine = Machine::create($this->validated($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Máquina registrada.']);

        return to_route('machines.show', $machine);
    }

    public function edit(Request $request, Machine $machine): Response
    {
        $this->ensureVisible($request, $machine);

        return Inertia::render('machines/form', $this->formProps($request, $machine));
    }

    public function update(Request $request, Machine $machine): RedirectResponse
    {
        $this->ensureVisible($request, $machine);

        $machine->update($this->validated($request, $machine));

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
        ], [
            'client_id.required_if' => 'Seleccione el cliente donde se instala la máquina.',
        ]);

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

        // Una vez que hay cortes, los contadores solo cambian a través de los cortes.
        if ($machine?->collectionItems()->exists()) {
            unset($data['counter_in'], $data['counter_out'], $data['credit_value']);
        } else {
            $data['counter_in'] ??= 0;
            $data['counter_out'] ??= 0;
        }

        return $data;
    }
}

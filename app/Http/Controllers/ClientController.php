<?php

namespace App\Http\Controllers;

use App\Enums\MachineStatus;
use App\Models\Client;
use App\Services\PhotoStorage;
use Carbon\CarbonInterface;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClientController extends Controller
{
    /**
     * Fotos del cliente: columna => campo del formulario.
     */
    private const PHOTO_FIELDS = [
        'photo_path' => 'photo',
        'business_photo_path' => 'business_photo',
    ];

    public function __construct(private PhotoStorage $photos) {}

    /**
     * Vista de ruta: tarjetas por cliente con el estado de cobro del ciclo (semana actual,
     * lunes a domingo) y filtro por día de visita.
     */
    public function index(Request $request): Response
    {
        $week = [
            now()->startOfWeek(CarbonInterface::MONDAY)->toDateString(),
            now()->endOfWeek(CarbonInterface::SUNDAY)->toDateString(),
        ];

        $clients = Client::query()
            ->visibleTo($request->user())
            ->with([
                'collectionRoute:id,code,name',
                'machines' => fn ($q) => $q
                    ->where('status', MachineStatus::Installed)
                    ->orderBy('code')
                    ->select(['id', 'office_id', 'client_id', 'code', 'brand', 'model', 'credit_value', 'counter_in', 'counter_out', 'status']),
                'activeLoans:id,client_id,balance,installment_amount',
            ])
            ->withCount([
                'machines',
                'machines as installed_machines_count' => fn ($q) => $q->where('status', MachineStatus::Installed),
                // Máquinas instaladas que ya tienen lectura en un corte de este cliente esta semana.
                'machines as collected_machines_count' => fn ($q) => $q
                    ->where('status', MachineStatus::Installed)
                    ->whereHas('collectionItems.collection', fn ($c) => $c
                        ->whereColumn('collections.client_id', 'machines.client_id')
                        ->whereBetween('collected_on', $week)),
            ])
            ->withMax(['collections as week_collection_id' => fn ($q) => $q->whereBetween('collected_on', $week)], 'id')
            ->withSum('activeLoans as loans_balance', 'balance')
            ->when($request->string('search')->value(), fn ($q, $search) => $q->whereAny(['name', 'business_name', 'document', 'phone'], 'ilike', "%{$search}%"))
            ->when($request->integer('route_id'), fn ($q, $routeId) => $q->where('collection_route_id', $routeId))
            ->when($request->integer('day'), fn ($q, $day) => $q->where('visit_day', $day))
            ->orderBy('collection_route_id')
            ->orderBy('visit_order')
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('clients/index', [
            'clients' => $clients,
            'filters' => $request->only('search', 'route_id', 'day'),
            'routes' => $this->routeOptions($request->user()),
            'today' => now()->dayOfWeekIso,
            'week' => ['from' => $week[0], 'to' => $week[1]],
            'moveClients' => $this->moveClientOptions($request->user()),
        ]);
    }

    /**
     * Guarda la coordenada actual del negocio tomada desde el teléfono del cobrador.
     */
    public function updateLocation(Request $request, Client $client): RedirectResponse
    {
        $this->ensureVisible($request, $client);
        abort_unless($request->user()->canAny(['clients.manage', 'collections.create']), 403);

        $client->update($request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ubicación del negocio actualizada.']);

        return back();
    }

    /**
     * Foto del cliente ("client") o de su negocio ("business").
     */
    public function photo(Request $request, Client $client, string $kind): StreamedResponse
    {
        $this->ensureVisible($request, $client);

        return $this->photos->response($kind === 'business' ? $client->business_photo_path : $client->photo_path);
    }

    public function show(Request $request, Client $client): Response
    {
        $this->ensureVisible($request, $client);

        $client->load([
            'collectionRoute.office:id,name',
            'collectionRoute.collector:id,name',
            'machines' => fn ($q) => $q->orderBy('code'),
            'loans' => fn ($q) => $q->latest('issued_on'),
        ]);

        return Inertia::render('clients/show', [
            'client' => $client,
            'moveClients' => $this->moveClientOptions($request->user()),
            'collections' => $client->collections()
                ->with('user:id,name')
                ->latest('collected_on')
                ->latest('id')
                ->paginate(15)
                ->withQueryString(),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('clients/form', [
            'client' => null,
            'routes' => $this->routeOptions($request->user()),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $client = Client::create($this->validated($request));

        $this->photos->sync($client, $request, self::PHOTO_FIELDS, "clients/{$client->id}");

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Cliente creado.']);

        return to_route('clients.show', $client);
    }

    public function edit(Request $request, Client $client): Response
    {
        $this->ensureVisible($request, $client);

        return Inertia::render('clients/form', [
            'client' => $client,
            'routes' => $this->routeOptions($request->user()),
        ]);
    }

    public function update(Request $request, Client $client): RedirectResponse
    {
        $this->ensureVisible($request, $client);

        $client->update($this->validated($request));

        $this->photos->sync($client, $request, self::PHOTO_FIELDS, "clients/{$client->id}");

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Cliente actualizado.']);

        return to_route('clients.show', $client);
    }

    public function destroy(Request $request, Client $client): RedirectResponse
    {
        $this->ensureVisible($request, $client);

        if ($client->collections()->exists() || $client->loans()->exists() || $client->machines()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'El cliente tiene máquinas, cortes o préstamos; desactívelo en lugar de eliminarlo.']);

            return back();
        }

        $client->delete();

        $this->photos->deleteDirectory("clients/{$client->id}");

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Cliente eliminado.']);

        return to_route('clients.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'collection_route_id' => ['required', 'integer', 'exists:collection_routes,id'],
            'name' => ['required', 'string', 'max:120'],
            'business_name' => ['nullable', 'string', 'max:120'],
            'document' => ['nullable', 'string', 'max:40'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'commission_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'visit_order' => ['nullable', 'integer', 'min:0'],
            'visit_day' => ['nullable', 'integer', 'between:1,7'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['boolean'],
            'photo' => PhotoStorage::rules(),
            'business_photo' => PhotoStorage::rules(),
            'remove_photo' => ['sometimes', 'boolean'],
            'remove_business_photo' => ['sometimes', 'boolean'],
        ], PhotoStorage::messages(array_values(self::PHOTO_FIELDS)), [
            'photo' => 'foto del cliente',
            'business_photo' => 'foto del negocio',
        ]);

        $this->ensureRouteAllowed($request->user(), $data['collection_route_id']);
        $data['visit_order'] ??= 0;

        // Las fotos se guardan aparte (PhotoStorage::sync).
        return Arr::except($data, ['photo', 'business_photo', 'remove_photo', 'remove_business_photo']);
    }
}

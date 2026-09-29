<?php

namespace App\Http\Controllers;

use App\Models\Client;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ClientController extends Controller
{
    public function index(Request $request): Response
    {
        $clients = Client::query()
            ->visibleTo($request->user())
            ->with('collectionRoute:id,code,name')
            ->withCount('machines')
            ->withSum('activeLoans as loans_balance', 'balance')
            ->when($request->string('search')->value(), fn ($q, $search) => $q->whereAny(['name', 'business_name', 'document', 'phone'], 'ilike', "%{$search}%"))
            ->when($request->integer('route_id'), fn ($q, $routeId) => $q->where('collection_route_id', $routeId))
            ->orderBy('collection_route_id')
            ->orderBy('visit_order')
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('clients/index', [
            'clients' => $clients,
            'filters' => $request->only('search', 'route_id'),
            'routes' => $this->routeOptions($request->user()),
        ]);
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
            'commission_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'visit_order' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['boolean'],
        ]);

        $this->ensureRouteAllowed($request->user(), $data['collection_route_id']);
        $data['visit_order'] ??= 0;

        return $data;
    }
}

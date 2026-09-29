<?php

namespace App\Http\Controllers;

use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Collection;
use App\Services\CollectionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CollectionController extends Controller
{
    public function __construct(private CollectionService $service) {}

    public function index(Request $request): Response
    {
        $from = $request->date('from')?->toDateString() ?? now()->startOfMonth()->toDateString();
        $to = $request->date('to')?->toDateString() ?? now()->toDateString();

        $query = Collection::query()
            ->visibleTo($request->user())
            ->whereBetween('collected_on', [$from, $to])
            ->when($request->integer('route_id'), fn ($q, $routeId) => $q->where('collection_route_id', $routeId))
            ->when($request->string('search')->value(), fn ($q, $search) => $q->whereHas('client', fn ($c) => $c->whereAny(['name', 'business_name'], 'ilike', "%{$search}%")));

        return Inertia::render('collections/index', [
            'collections' => (clone $query)
                ->with(['client:id,name', 'collectionRoute:id,code', 'user:id,name'])
                ->withCount('items')
                ->latest('collected_on')
                ->latest('id')
                ->paginate(25)
                ->withQueryString(),
            'totals' => $query
                ->selectRaw('count(*) as count, coalesce(sum(net), 0) as net, coalesce(sum(client_share), 0) as client_share, coalesce(sum(company_share), 0) as company_share, coalesce(sum(cash_delivered), 0) as cash_delivered')
                ->first(),
            'filters' => ['from' => $from, 'to' => $to, ...$request->only('route_id', 'search')],
            'routes' => $this->routeOptions($request->user()),
        ]);
    }

    public function create(Request $request): Response
    {
        $client = null;

        if ($request->integer('client_id')) {
            $client = Client::query()
                ->visibleTo($request->user())
                ->with([
                    'collectionRoute:id,code,name',
                    'machines' => fn ($q) => $q->where('status', MachineStatus::Installed)->orderBy('code'),
                    'activeLoans:id,client_id,balance,installment_amount,frequency',
                ])
                ->findOrFail($request->integer('client_id'));
        }

        return Inertia::render('collections/create', [
            'client' => $client,
            'clients' => Client::query()
                ->visibleTo($request->user())
                ->where('is_active', true)
                ->whereHas('machines', fn ($q) => $q->where('status', MachineStatus::Installed))
                ->with('collectionRoute:id,code')
                ->orderBy('collection_route_id')
                ->orderBy('visit_order')
                ->orderBy('name')
                ->get(['id', 'name', 'collection_route_id'])
                ->map(fn (Client $c) => ['id' => $c->id, 'name' => "{$c->collectionRoute->code} · {$c->name}"]),
            'today' => now()->toDateString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'collected_on' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'loan_id' => ['nullable', 'integer'],
            'loan_deduction' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.machine_id' => ['required', 'integer', 'distinct'],
            'items.*.current_in' => ['required', 'integer', 'min:0'],
            'items.*.current_out' => ['required', 'integer', 'min:0'],
            'items.*.forced' => ['sometimes', 'boolean'],
        ]);

        $client = Client::query()->visibleTo($request->user())->findOrFail($request->integer('client_id'));

        $collection = $this->service->record($request->user(), $client, $data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Corte registrado.']);

        return to_route('collections.show', $collection);
    }

    public function show(Request $request, Collection $collection): Response
    {
        $this->ensureVisible($request, $collection);

        $collection->load([
            'client:id,name,business_name',
            'collectionRoute:id,code,name',
            'office:id,name',
            'user:id,name',
            'items.machine:id,code,brand,model',
            'loanPayment',
        ]);

        return Inertia::render('collections/show', ['collection' => $collection]);
    }

    public function destroy(Request $request, Collection $collection): RedirectResponse
    {
        $this->ensureVisible($request, $collection);

        $this->service->void($collection);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Corte anulado; contadores restaurados.']);

        return to_route('collections.index');
    }
}

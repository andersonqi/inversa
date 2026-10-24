<?php

namespace App\Http\Controllers;

use App\Enums\MachineStatus;
use App\Http\Requests\StoreCollectionRequest;
use App\Models\Client;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\Machine;
use App\Services\CollectionService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

            // Histórico rápido: últimas 4 lecturas de cada máquina.
            $client->machines->each(fn (Machine $machine) => $machine->setRelation(
                'recentReadings',
                $machine->collectionItems()
                    ->with('collection:id,collected_on')
                    ->latest('id')
                    ->limit(4)
                    ->get(),
            ));
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

    public function store(StoreCollectionRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $client = Client::query()->visibleTo($request->user())->findOrFail($request->integer('client_id'));

        $collection = $this->service->record($request->user(), $client, $data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Corte registrado.']);

        return to_route('collections.receipt', $collection);
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

    /**
     * Recibo imprimible en formato de ticket térmico (58 / 80 mm).
     */
    public function receipt(Request $request, Collection $collection): Response
    {
        $this->ensureVisible($request, $collection);

        $collection->load([
            'client:id,name,business_name,phone,address',
            'collectionRoute:id,code,name',
            'office:id,name',
            'user:id,name',
            'items.machine:id,code,brand,model',
        ]);

        return Inertia::render('collections/receipt', [
            'collection' => $collection,
            // Saldo vigente de préstamos del cliente al momento de imprimir.
            'loansBalance' => (float) $collection->client->activeLoans()->sum('balance'),
        ]);
    }

    /**
     * Imagen de la firma del tendero.
     */
    public function signature(Request $request, Collection $collection): StreamedResponse
    {
        $this->ensureVisible($request, $collection);

        return $this->privateFile($collection->signature_path);
    }

    /**
     * Foto de evidencia de los contadores de una máquina del corte.
     */
    public function photo(Request $request, Collection $collection, CollectionItem $item): StreamedResponse
    {
        $this->ensureVisible($request, $collection);
        abort_unless($item->collection_id === $collection->id, 404);

        return $this->privateFile($item->photo_path);
    }

    public function destroy(Request $request, Collection $collection): RedirectResponse
    {
        $this->ensureVisible($request, $collection);

        $this->service->void($collection);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Corte anulado; contadores restaurados.']);

        return to_route('collections.index');
    }

    private function privateFile(?string $path): StreamedResponse
    {
        $disk = Storage::disk(CollectionService::DISK);
        assert($disk instanceof FilesystemAdapter);

        abort_unless($path !== null && $disk->exists($path), 404);

        return $disk->response($path);
    }
}

<?php

namespace App\Http\Controllers;

use App\Enums\LoanStatus;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\CollectionRoute;
use App\Models\Expense;
use App\Models\Loan;
use App\Models\LoanPayment;
use App\Support\PerformanceThresholds;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('reports/index');
    }

    /**
     * Cuadre diario: cortes por ruta, gastos, préstamos y efectivo neto del día.
     */
    public function daily(Request $request): Response
    {
        $user = $request->user();
        $date = $request->date('date')?->toDateString() ?? now()->toDateString();
        $officeId = $request->integer('office_id') ?: null;

        $collections = Collection::query()
            ->visibleTo($user)
            ->whereDate('collected_on', $date)
            ->when($officeId, fn ($q) => $q->where('collections.office_id', $officeId));

        $byRoute = (clone $collections)
            ->join('collection_routes', 'collection_routes.id', '=', 'collections.collection_route_id')
            ->groupBy('collection_routes.id', 'collection_routes.code', 'collection_routes.name')
            ->orderBy('collection_routes.code')
            ->selectRaw('collection_routes.id, collection_routes.code, collection_routes.name, count(*) as visits,
                sum(collections.total_in) as total_in, sum(collections.total_out) as total_out, sum(collections.net) as net,
                sum(collections.client_share) as client_share, sum(collections.company_share) as company_share,
                sum(collections.loan_deduction) as loan_deduction, sum(collections.cash_delivered) as cash_delivered')
            ->get();

        $expenses = Expense::query()
            ->visibleTo($user)
            ->whereDate('spent_on', $date)
            ->when($officeId, fn ($q) => $q->where('office_id', $officeId))
            ->with(['collectionRoute:id,code', 'user:id,name'])
            ->orderBy('id')
            ->get();

        $loans = Loan::query()
            ->visibleTo($user)
            ->whereDate('issued_on', $date)
            ->where('status', '!=', LoanStatus::Cancelled)
            ->when($officeId, fn ($q) => $q->where('office_id', $officeId))
            ->with('client:id,name')
            ->get();

        $directPayments = LoanPayment::query()
            ->whereNull('collection_id')
            ->whereDate('paid_on', $date)
            ->whereIn('loan_id', Loan::query()->visibleTo($user)->when($officeId, fn ($q) => $q->where('office_id', $officeId))->select('id'))
            ->sum('amount');

        $losing = CollectionItem::query()
            ->whereIn('collection_id', (clone $collections)->select('id'))
            ->where('net', '<', 0)
            ->with(['machine:id,code', 'collection:id,client_id', 'collection.client:id,name'])
            ->orderBy('net')
            ->get();

        $cashDelivered = (float) $byRoute->sum('cash_delivered');
        $expensesTotal = (float) $expenses->sum('amount');
        $loansTotal = (float) $loans->sum('principal');

        return Inertia::render('reports/daily', [
            'filters' => ['date' => $date, 'office_id' => $officeId],
            'offices' => $this->officeOptions($user),
            'byRoute' => $byRoute,
            'expenses' => $expenses,
            'loans' => $loans,
            'losing' => $losing,
            'summary' => [
                'net' => (float) $byRoute->sum('net'),
                'client_share' => (float) $byRoute->sum('client_share'),
                'cash_delivered' => $cashDelivered,
                'loan_payments' => (float) $directPayments,
                'expenses' => $expensesTotal,
                'loans_issued' => $loansTotal,
                'cash_balance' => round($cashDelivered + (float) $directPayments - $expensesTotal - $loansTotal, 2),
            ],
        ]);
    }

    /**
     * Rendimiento por máquina en un período; resalta las máquinas perdedoras.
     */
    public function machines(Request $request): Response
    {
        $user = $request->user();
        [$from, $to] = $this->period($request);
        $officeId = $request->integer('office_id') ?: null;
        $onlyLosing = $request->boolean('only_losing', true);

        $visibleCollections = Collection::query()
            ->visibleTo($user)
            ->whereBetween('collected_on', [$from, $to])
            ->when($officeId, fn ($q) => $q->where('office_id', $officeId))
            ->select('id');

        $base = CollectionItem::query()
            ->join('machines', 'machines.id', '=', 'collection_items.machine_id')
            ->leftJoin('clients', 'clients.id', '=', 'machines.client_id')
            ->leftJoin('collection_routes', 'collection_routes.id', '=', 'clients.collection_route_id')
            ->whereIn('collection_items.collection_id', $visibleCollections)
            ->groupBy('machines.id', 'machines.code', 'machines.brand', 'machines.model', 'clients.name', 'collection_routes.code')
            ->selectRaw('machines.id, machines.code, machines.brand, machines.model, clients.name as client_name, collection_routes.code as route_code,
                count(*) as readings, sum(collection_items.amount_in) as amount_in, sum(collection_items.amount_out) as amount_out,
                sum(collection_items.net) as net,
                case when sum(collection_items.amount_in) > 0 then round(sum(collection_items.amount_out) / sum(collection_items.amount_in) * 100, 2) else 0 end as payout_percent')
            ->when($onlyLosing, fn (Builder $q) => $q->havingRaw('sum(collection_items.net) < 0'));

        $summary = DB::query()->fromSub((clone $base)->toBase(), 'report')
            ->selectRaw('count(*) as machines, coalesce(sum(net), 0) as net')
            ->first();

        // Semanas del período para expresar el neto como promedio semanal (mínimo una).
        $days = (int) floor(CarbonImmutable::parse($from)->diffInDays(CarbonImmutable::parse($to))) + 1;

        return Inertia::render('reports/machines', [
            'filters' => ['from' => $from, 'to' => $to, 'office_id' => $officeId, 'only_losing' => $onlyLosing],
            'offices' => $this->officeOptions($user),
            'rows' => $base->orderBy('net')->orderBy('machines.code')->paginate(25)->withQueryString(),
            'summary' => ['machines' => (int) ($summary->machines ?? 0), 'net' => (float) ($summary->net ?? 0)],
            'weeks' => round(max(1, $days / 7), 4),
            'thresholds' => PerformanceThresholds::current()->toArray(),
        ]);
    }

    /**
     * Rentabilidad por ruta: ganancia de la empresa menos gastos de la ruta.
     */
    public function routes(Request $request): Response
    {
        $user = $request->user();
        [$from, $to] = $this->period($request);
        $officeId = $request->integer('office_id') ?: null;

        $collections = Collection::query()
            ->visibleTo($user)
            ->whereBetween('collected_on', [$from, $to])
            ->when($officeId, fn ($q) => $q->where('office_id', $officeId))
            ->groupBy('collection_route_id')
            ->selectRaw('collection_route_id, count(*) as visits, sum(net) as net, sum(client_share) as client_share, sum(company_share) as company_share')
            ->get()
            ->keyBy('collection_route_id');

        $expenses = Expense::query()
            ->visibleTo($user)
            ->whereBetween('spent_on', [$from, $to])
            ->when($officeId, fn ($q) => $q->where('office_id', $officeId))
            ->whereNotNull('collection_route_id')
            ->groupBy('collection_route_id')
            ->selectRaw('collection_route_id, sum(amount) as total')
            ->pluck('total', 'collection_route_id');

        $rows = CollectionRoute::query()
            ->visibleTo($user)
            ->when($officeId, fn ($q) => $q->where('office_id', $officeId))
            ->with(['office:id,name', 'collector:id,name'])
            ->withCount(['clients', 'clients as machines_count' => fn ($q) => $q->join('machines', 'machines.client_id', '=', 'clients.id')])
            ->orderBy('code')
            ->paginate(25)
            ->withQueryString()
            ->through(function (CollectionRoute $route) use ($collections, $expenses) {
                $c = $collections->get($route->id);
                $companyShare = (float) ($c->company_share ?? 0);
                $routeExpenses = (float) ($expenses[$route->id] ?? 0);

                return [
                    'id' => $route->id,
                    'code' => $route->code,
                    'name' => $route->name,
                    'office' => $route->office->name,
                    'collector' => $route->collector?->name,
                    'clients_count' => $route->clients_count,
                    'machines_count' => (int) $route->getAttribute('machines_count'),
                    'visits' => (int) ($c->visits ?? 0),
                    'net' => (float) ($c->net ?? 0),
                    'client_share' => (float) ($c->client_share ?? 0),
                    'company_share' => $companyShare,
                    'expenses' => $routeExpenses,
                    'profit' => round($companyShare - $routeExpenses, 2),
                ];
            });

        // Totales de todas las rutas del filtro, no solo de la página visible.
        $companyTotal = (float) $collections->sum('company_share');
        $expensesTotal = (float) $expenses->sum();

        return Inertia::render('reports/routes', [
            'filters' => ['from' => $from, 'to' => $to, 'office_id' => $officeId],
            'offices' => $this->officeOptions($user),
            'rows' => $rows,
            'totals' => [
                'visits' => (int) $collections->sum('visits'),
                'net' => (float) $collections->sum('net'),
                'client_share' => (float) $collections->sum('client_share'),
                'company_share' => $companyTotal,
                'expenses' => $expensesTotal,
                'profit' => round($companyTotal - $expensesTotal, 2),
            ],
        ]);
    }

    /**
     * Cartera de préstamos activos con mora a la fecha (calculada en la base de datos
     * para poder ordenar y paginar por mora).
     */
    public function loans(Request $request): Response
    {
        $user = $request->user();
        $officeId = $request->integer('office_id') ?: null;
        $today = CarbonImmutable::today();

        $base = Loan::query()
            ->visibleTo($user)
            ->where('status', LoanStatus::Active)
            ->when($officeId, fn ($q) => $q->where('office_id', $officeId))
            ->withArrears($today);

        $summary = DB::query()->fromSub((clone $base)->toBase(), 'portfolio')
            ->selectRaw('count(*) as count, coalesce(sum(balance), 0) as balance, coalesce(sum(arrears), 0) as arrears, count(case when arrears > 0 then 1 end) as in_arrears')
            ->first();

        $rows = $base
            ->with(['client:id,name,collection_route_id', 'client.collectionRoute:id,code'])
            ->withMax('payments as last_payment_on', 'paid_on')
            ->orderByDesc('arrears')
            ->orderBy('first_due_on')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Loan $loan) => [
                'id' => $loan->id,
                'client' => $loan->client->name,
                'route' => $loan->client->collectionRoute->code,
                'issued_on' => $loan->issued_on->toDateString(),
                'total' => (float) $loan->total,
                'balance' => (float) $loan->balance,
                'installment_amount' => (float) $loan->installment_amount,
                'frequency' => $loan->frequency->label(),
                'last_payment_on' => $loan->getAttribute('last_payment_on'),
                'arrears' => (float) $loan->getAttribute('arrears'),
            ]);

        return Inertia::render('reports/loans', [
            'filters' => ['office_id' => $officeId],
            'offices' => $this->officeOptions($user),
            'rows' => $rows,
            'summary' => [
                'count' => (int) ($summary->count ?? 0),
                'balance' => round((float) ($summary->balance ?? 0), 2),
                'arrears' => round((float) ($summary->arrears ?? 0), 2),
                'in_arrears' => (int) ($summary->in_arrears ?? 0),
            ],
        ]);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function period(Request $request): array
    {
        return [
            $request->date('from')?->toDateString() ?? now()->startOfMonth()->toDateString(),
            $request->date('to')?->toDateString() ?? now()->toDateString(),
        ];
    }
}

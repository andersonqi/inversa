<?php

namespace App\Http\Controllers;

use App\Enums\LoanStatus;
use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\Expense;
use App\Models\Loan;
use App\Models\Machine;
use App\Models\User;
use App\Support\PerformanceThresholds;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Panel: los indicadores salen de pocas consultas agregadas (una por tabla) y el
 * gráfico y los últimos cortes se cargan en diferido para no retrasar la página.
 */
class DashboardController extends Controller
{
    /**
     * Días del período para faltantes y rendimiento de máquinas.
     */
    private const PERIOD_DAYS = 30;

    /**
     * Semanas del comparativo de recaudación.
     */
    private const WEEKS = 4;

    /**
     * Días sin abono a partir de los cuales un préstamo se marca en mora.
     */
    private const STALE_LOAN_DAYS = 15;

    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('dashboard', [
            'stats' => fn () => $this->stats($user),
            'series' => Inertia::defer(fn () => $this->series($user), 'activity'),
            'recent' => Inertia::defer(fn () => Collection::query()
                ->visibleTo($user)
                ->with(['client:id,name', 'collectionRoute:id,code'])
                ->latest('id')
                ->limit(8)
                ->get(['id', 'client_id', 'collection_route_id', 'collected_on', 'net', 'cash_delivered']), 'activity'),
            // Estadísticas de ruta (cobertura, comparativo semanal, faltantes, rendimiento y mora).
            'route' => Inertia::defer(fn () => $this->routeStats($user), 'route'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function routeStats(User $user): array
    {
        $weekStart = now()->startOfWeek(CarbonInterface::MONDAY);
        $week = [$weekStart->toDateString(), $weekStart->addDays(6)->toDateString()];
        $since = now()->subDays(self::PERIOD_DAYS - 1)->toDateString();
        $today = now()->toDateString();

        return [
            'week' => ['from' => $week[0], 'to' => $week[1]],
            'coverage' => $this->coverage($user, $week),
            'weekly' => $this->weeklyComparison($user, $weekStart),
            'shortages' => $this->topShortages($user, [$since, $today]),
            'performance' => $this->performance($user, [$since, $today]),
            'arrears' => $this->staleLoans($user),
        ];
    }

    /**
     * Clientes visitados y máquinas cobradas en la semana sobre el total instalado.
     *
     * @param  array{0: string, 1: string}  $week
     * @return array{clients_visited: int, clients_total: int, machines_collected: int, machines_total: int}
     */
    private function coverage(User $user, array $week): array
    {
        $clients = Client::query()
            ->visibleTo($user)
            ->where('is_active', true)
            ->whereHas('machines', fn ($q) => $q->where('status', MachineStatus::Installed));

        $machines = Machine::query()->visibleTo($user)->where('status', MachineStatus::Installed);

        return [
            'clients_visited' => (clone $clients)->whereHas('collections', fn ($q) => $q->whereBetween('collected_on', $week))->count(),
            'clients_total' => $clients->count(),
            'machines_collected' => (clone $machines)->whereHas('collectionItems.collection', fn ($q) => $q->whereBetween('collected_on', $week))->count(),
            'machines_total' => $machines->count(),
        ];
    }

    /**
     * Efectivo recaudado por día (lunes a domingo) de la semana actual y las 3 anteriores,
     * de la más reciente a la más antigua.
     *
     * @return array<int, array{from: string, days: list<float>, total: float}>
     */
    private function weeklyComparison(User $user, CarbonInterface $weekStart): array
    {
        $first = $weekStart->subWeeks(self::WEEKS - 1);

        $daily = Collection::query()
            ->visibleTo($user)
            ->whereBetween('collected_on', [$first->toDateString(), $weekStart->addDays(6)->toDateString()])
            ->groupBy('collected_on')
            ->selectRaw('collected_on, sum(cash_delivered) as cash')
            ->pluck('cash', 'collected_on');

        $weeks = [];

        for ($w = self::WEEKS - 1; $w >= 0; $w--) {
            $start = $weekStart->subWeeks($w);
            $days = [];

            for ($d = 0; $d < 7; $d++) {
                $days[] = round((float) ($daily[$start->addDays($d)->toDateString()] ?? 0), 2);
            }

            $weeks[] = ['from' => $start->toDateString(), 'days' => $days, 'total' => round(array_sum($days), 2)];
        }

        return array_reverse($weeks);
    }

    /**
     * Máquinas con mayor faltante (efectivo contado menor al teórico) en el período.
     *
     * @param  array{0: string, 1: string}  $period
     * @return array<int, array{machine_id: int, code: string, client: string|null, difference: float, readings: int}>
     */
    private function topShortages(User $user, array $period): array
    {
        return CollectionItem::query()
            ->whereIn('collection_id', Collection::query()->visibleTo($user)->whereBetween('collected_on', $period)->select('id'))
            ->whereNotNull('cash_counted')
            ->groupBy('machine_id')
            ->havingRaw('sum(cash_counted - net) < 0')
            ->selectRaw('machine_id, sum(cash_counted - net) as difference, count(*) as readings')
            ->orderBy('difference')
            ->limit(5)
            ->with(['machine:id,code,client_id', 'machine.client:id,name'])
            ->get()
            ->map(fn (CollectionItem $item) => [
                'machine_id' => $item->machine_id,
                'code' => $item->machine->code,
                'client' => $item->machine->client?->name,
                'difference' => round((float) $item->getAttribute('difference'), 2),
                'readings' => (int) $item->getAttribute('readings'),
            ])
            ->values()
            ->all();
    }

    /**
     * Clasifica las máquinas instaladas por su ganancia neta promedio por semana en su
     * ubicación actual (últimos 30 días, o desde su instalación si es más reciente, con un
     * mínimo de una semana), según los montos configurados (PerformanceThresholds).
     *
     * @param  array{0: string, 1: string}  $period
     * @return array{average: float, excellent: int, good: int, poor: int, thresholds: array{excellent: float, poor: float, excellent_presets: list<int>, poor_presets: list<int>}, worst: array<int, array{machine_id: int, code: string, client: string|null, net: float, weekly: float}>}
     */
    private function performance(User $user, array $period): array
    {
        $thresholds = PerformanceThresholds::current();
        $start = CarbonImmutable::parse($period[0]);
        $end = CarbonImmutable::parse($period[1]);

        $machines = Machine::query()
            ->visibleTo($user)
            ->where('status', MachineStatus::Installed)
            ->with('client:id,name')
            ->withSum(['collectionItems as period_net' => fn ($q) => $q->whereHas('collection', fn ($c) => $c
                ->whereBetween('collected_on', $period)
                // Solo lo cobrado desde que está en su ubicación actual.
                ->whereRaw('collections.collected_on >= coalesce(machines.installed_at, ?)', [$period[0]]))], 'net')
            ->get(['id', 'code', 'client_id', 'installed_at']);

        $rows = $machines->map(function (Machine $machine) use ($start, $end, $thresholds) {
            $since = $machine->installed_at && $machine->installed_at->gt($start)
                ? CarbonImmutable::parse($machine->installed_at->toDateString())
                : $start;
            $days = max(7, (int) floor($since->diffInDays($end)) + 1);
            $net = round((float) $machine->getAttribute('period_net'), 2);
            $weekly = round($net / ($days / 7), 2);

            return [
                'machine' => $machine,
                'net' => $net,
                'weekly' => $weekly,
                'level' => $thresholds->classify($weekly),
            ];
        });

        $counts = ['excellent' => 0, 'good' => 0, 'poor' => 0];

        foreach ($rows as $row) {
            $counts[$row['level']]++;
        }

        $worst = $rows
            ->filter(fn (array $row) => $row['level'] === 'poor')
            ->sortBy('weekly')
            ->take(5)
            ->map(fn (array $row) => [
                'machine_id' => $row['machine']->id,
                'code' => $row['machine']->code,
                'client' => $row['machine']->client?->name,
                'net' => $row['net'],
                'weekly' => $row['weekly'],
            ])
            ->values()
            ->all();

        return [
            // Promedio semanal por máquina, como referencia para ajustar los montos.
            'average' => $rows->isEmpty() ? 0.0 : round((float) $rows->avg('weekly'), 2),
            ...$counts,
            'thresholds' => $thresholds->toArray(),
            'worst' => $worst,
        ];
    }

    /**
     * Préstamos activos sin abonos en los últimos 15 días (otorgados hace más de 15 días).
     *
     * @return array{count: int, balance: float, loans: array<int, array{id: int, client: string, route: string, balance: float, last_payment_on: string|null, days: int}>}
     */
    private function staleLoans(User $user): array
    {
        $limit = now()->subDays(self::STALE_LOAN_DAYS)->toDateString();
        $today = now()->startOfDay();

        $loans = Loan::query()
            ->visibleTo($user)
            ->where('status', LoanStatus::Active)
            ->where('issued_on', '<', $limit)
            ->whereDoesntHave('payments', fn ($q) => $q->where('paid_on', '>=', $limit))
            ->with(['client:id,name,collection_route_id', 'client.collectionRoute:id,code'])
            ->withMax('payments as last_payment_on', 'paid_on')
            ->get()
            ->map(function (Loan $loan) use ($today) {
                $lastPayment = $loan->getAttribute('last_payment_on');
                $since = $lastPayment ? CarbonImmutable::parse((string) $lastPayment) : $loan->issued_on;

                return [
                    'id' => $loan->id,
                    'client' => $loan->client->name,
                    'route' => $loan->client->collectionRoute->code,
                    'balance' => (float) $loan->balance,
                    'last_payment_on' => $lastPayment ? substr((string) $lastPayment, 0, 10) : null,
                    'days' => (int) $since->startOfDay()->diffInDays($today),
                ];
            })
            ->sortByDesc('days')
            ->values();

        return [
            'count' => $loans->count(),
            'balance' => round((float) $loans->sum('balance'), 2),
            'loans' => $loans->take(10)->all(),
        ];
    }

    /**
     * @return array<string, float|int>
     */
    private function stats(User $user): array
    {
        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();

        // Un solo recorrido del mes calcula lo del día y lo del mes.
        $collections = Collection::query()
            ->visibleTo($user)
            ->whereBetween('collected_on', [$monthStart, $today])
            ->toBase()
            ->selectRaw('
                coalesce(sum(case when collected_on = ? then net end), 0) as today_net,
                coalesce(sum(case when collected_on = ? then cash_delivered end), 0) as today_cash,
                count(case when collected_on = ? then 1 end) as today_visits,
                coalesce(sum(company_share), 0) as month_company
            ', [$today, $today, $today])
            ->first();

        $machines = Machine::query()
            ->visibleTo($user)
            ->toBase()
            ->selectRaw('count(case when status = ? then 1 end) as installed, count(case when status <> ? then 1 end) as total', [
                MachineStatus::Installed->value,
                MachineStatus::Retired->value,
            ])
            ->first();

        $losingMonth = DB::query()
            ->fromSub(
                CollectionItem::query()
                    ->whereIn('collection_id', Collection::query()->visibleTo($user)->whereBetween('collected_on', [$monthStart, $today])->select('id'))
                    ->groupBy('machine_id')
                    ->havingRaw('sum(net) < 0')
                    ->select('machine_id'),
                'losing',
            )
            ->count();

        return [
            'today_net' => (float) ($collections->today_net ?? 0),
            'today_cash' => (float) ($collections->today_cash ?? 0),
            'today_visits' => (int) ($collections->today_visits ?? 0),
            'month_company' => (float) ($collections->month_company ?? 0),
            'month_expenses' => (float) Expense::query()->visibleTo($user)->whereBetween('spent_on', [$monthStart, $today])->sum('amount'),
            'loans_balance' => (float) Loan::query()->visibleTo($user)->where('status', LoanStatus::Active)->sum('balance'),
            'machines_installed' => (int) ($machines->installed ?? 0),
            'machines_total' => (int) ($machines->total ?? 0),
            'losing_month' => $losingMonth,
        ];
    }

    /**
     * Ganancia de la empresa por día en los últimos 14 días (días sin cortes en cero).
     *
     * @return list<array{date: string, value: float}>
     */
    private function series(User $user): array
    {
        $since = now()->subDays(13)->toDateString();

        $daily = Collection::query()
            ->visibleTo($user)
            ->whereBetween('collected_on', [$since, now()->toDateString()])
            ->groupBy('collected_on')
            ->selectRaw('collected_on, sum(company_share) as company_share')
            ->pluck('company_share', 'collected_on');

        $series = [];

        for ($d = now()->subDays(13); $d->lte(now()); $d = $d->addDay()) {
            $key = $d->toDateString();
            $series[] = ['date' => $key, 'value' => (float) ($daily[$key] ?? 0)];
        }

        return $series;
    }
}

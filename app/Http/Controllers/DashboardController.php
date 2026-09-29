<?php

namespace App\Http\Controllers;

use App\Enums\LoanStatus;
use App\Enums\MachineStatus;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\Expense;
use App\Models\Loan;
use App\Models\Machine;
use App\Models\User;
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
        ]);
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

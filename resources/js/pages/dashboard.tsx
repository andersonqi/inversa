import { Deferred, Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Banknote,
    Gamepad2,
    HandCoins,
    Receipt,
    TrendingUp,
} from 'lucide-react';
import { DailyBars } from '@/components/app/daily-bars';
import { EmptyRow } from '@/components/app/empty-row';
import { Page, PageHeader, Panel } from '@/components/app/page';
import type { RouteStatsData } from '@/components/app/route-stats';
import { RouteStats } from '@/components/app/route-stats';
import { StatCard } from '@/components/app/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { date, money, signClass } from '@/lib/format';
import { dashboard } from '@/routes';
import collections from '@/routes/collections';
import reports from '@/routes/reports';
import type { Collection } from '@/types';

type Stats = {
    today_net: number;
    today_cash: number;
    today_visits: number;
    month_company: number;
    month_expenses: number;
    loans_balance: number;
    machines_installed: number;
    machines_total: number;
    losing_month: number;
};

export default function Dashboard({
    stats,
    series,
    recent,
    route,
}: {
    stats: Stats;
    series?: { date: string; value: number }[];
    recent?: Collection[];
    route?: RouteStatsData;
}) {
    const can = useCan();

    return (
        <Page>
            <Head title="Panel" />
            <PageHeader
                title="Panel"
                description="Resumen de la operación de hoy y del mes en curso."
                actions={
                    can('collections.create') && (
                        <Button asChild>
                            <Link href={collections.create()}>
                                <Banknote /> Registrar corte
                            </Link>
                        </Button>
                    )
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                    label="Efectivo recaudado hoy"
                    value={money(stats.today_cash)}
                    hint={`${stats.today_visits} cortes · neto ${money(stats.today_net)}`}
                    icon={Banknote}
                />
                <StatCard
                    label="Ganancia empresa (mes)"
                    value={money(stats.month_company)}
                    hint={`Gastos del mes ${money(stats.month_expenses)}`}
                    icon={TrendingUp}
                    tone="positive"
                />
                <StatCard
                    label="Utilidad del mes"
                    value={money(stats.month_company - stats.month_expenses)}
                    icon={Receipt}
                    tone={
                        stats.month_company - stats.month_expenses < 0
                            ? 'negative'
                            : 'default'
                    }
                />
                <StatCard
                    label="Máquinas instaladas"
                    value={`${stats.machines_installed} / ${stats.machines_total}`}
                    hint="Instaladas / en inventario activo"
                    icon={Gamepad2}
                />
                <StatCard
                    label="Máquinas perdedoras (mes)"
                    value={stats.losing_month}
                    hint="Pagaron más de lo que recibieron"
                    icon={AlertTriangle}
                    tone={stats.losing_month > 0 ? 'warning' : 'default'}
                />
                <StatCard
                    label="Cartera de préstamos"
                    value={money(stats.loans_balance)}
                    icon={HandCoins}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
                <Panel title="Ganancia de la empresa · últimos 14 días">
                    <div className="p-4 pt-8">
                        <Deferred
                            data="series"
                            fallback={<Skeleton className="h-48" />}
                        >
                            <DailyBars data={series ?? []} />
                        </Deferred>
                    </div>
                </Panel>

                <Panel
                    title="Últimos cortes"
                    actions={
                        can('reports.view') && (
                            <Link
                                href={reports.daily()}
                                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                            >
                                Cuadre del día →
                            </Link>
                        )
                    }
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead className="text-right">
                                    Neto
                                </TableHead>
                                <TableHead className="text-right">
                                    Efectivo
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <Deferred
                                data="recent"
                                fallback={
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={4}>
                                            <Skeleton className="h-40" />
                                        </TableCell>
                                    </TableRow>
                                }
                            >
                                <RecentRows recent={recent ?? []} />
                            </Deferred>
                        </TableBody>
                    </Table>
                </Panel>
            </div>

            <Deferred
                data="route"
                fallback={
                    <div className="grid gap-6 sm:grid-cols-2">
                        <Skeleton className="h-40" />
                        <Skeleton className="h-40" />
                    </div>
                }
            >
                {route ? <RouteStats data={route} /> : null}
            </Deferred>
        </Page>
    );
}

function RecentRows({ recent }: { recent: Collection[] }) {
    return (
        <>
            {recent.length === 0 && (
                <EmptyRow colSpan={4}>Aún no hay cortes.</EmptyRow>
            )}
            {recent.map((c) => (
                <TableRow key={c.id}>
                    <TableCell>
                        <Link
                            href={collections.show(c.id)}
                            className="underline-offset-4 hover:underline"
                        >
                            {date(c.collected_on)}
                        </Link>
                    </TableCell>
                    <TableCell>
                        {c.client?.name}
                        <span className="text-xs text-muted-foreground">
                            {' '}
                            · {c.collection_route?.code}
                        </span>
                    </TableCell>
                    <TableCell
                        className={`text-right tabular-nums ${signClass(c.net)}`}
                    >
                        {money(c.net)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                        {money(c.cash_delivered)}
                    </TableCell>
                </TableRow>
            ))}
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Panel', href: dashboard() }],
};

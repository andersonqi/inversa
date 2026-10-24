import { Link } from '@inertiajs/react';
import { Pill } from '@/components/app/badges';
import { Donut } from '@/components/app/donut';
import { EmptyRow } from '@/components/app/empty-row';
import { Panel } from '@/components/app/page';
import {
    PerformanceThresholdsEditor,
    thresholdsSummary,
} from '@/components/app/performance-thresholds';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { date, gtq, money, signClass } from '@/lib/format';
import { WEEK_DAYS } from '@/lib/route-tools';
import loans from '@/routes/loans';
import machines from '@/routes/machines';
import type { PerformanceThresholdsInfo } from '@/types';

export type RouteStatsData = {
    week: { from: string; to: string };
    coverage: {
        clients_visited: number;
        clients_total: number;
        machines_collected: number;
        machines_total: number;
    };
    weekly: { from: string; days: number[]; total: number }[];
    shortages: {
        machine_id: number;
        code: string;
        client: string | null;
        difference: number;
        readings: number;
    }[];
    performance: {
        /** Promedio semanal por máquina. */
        average: number;
        excellent: number;
        good: number;
        poor: number;
        thresholds: PerformanceThresholdsInfo;
        worst: {
            machine_id: number;
            code: string;
            client: string | null;
            net: number;
            weekly: number;
        }[];
    };
    arrears: {
        count: number;
        balance: number;
        loans: {
            id: number;
            client: string;
            route: string;
            balance: number;
            last_payment_on: string | null;
            days: number;
        }[];
    };
};

/**
 * Estadísticas de ruta del panel: cobertura de la semana, comparativo diario,
 * faltantes, rendimiento de máquinas y préstamos sin abono.
 */
export function RouteStats({ data }: { data: RouteStatsData }) {
    const { coverage, weekly, shortages, performance, arrears } = data;

    return (
        <div className="space-y-6">
            <Panel
                title={`Cobertura de la semana · ${date(data.week.from)} al ${date(data.week.to)}`}
            >
                <div className="grid gap-6 p-4 sm:grid-cols-2">
                    <Donut
                        label="Clientes visitados"
                        value={coverage.clients_visited}
                        total={coverage.clients_total}
                        hint="Clientes activos con máquinas instaladas"
                    />
                    <Donut
                        label="Máquinas cobradas"
                        value={coverage.machines_collected}
                        total={coverage.machines_total}
                        hint="Máquinas instaladas con lectura esta semana"
                    />
                </div>
            </Panel>

            <Panel title="Recaudación por día · últimas semanas">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Semana</TableHead>
                                {WEEK_DAYS.map((d) => (
                                    <TableHead
                                        key={d.value}
                                        className="text-right"
                                    >
                                        {d.short}
                                    </TableHead>
                                ))}
                                <TableHead className="text-right">
                                    Total
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {weekly.map((w, i) => (
                                <TableRow
                                    key={w.from}
                                    className={i === 0 ? 'font-medium' : ''}
                                >
                                    <TableCell className="whitespace-nowrap">
                                        {i === 0 ? 'Actual' : date(w.from)}
                                    </TableCell>
                                    {w.days.map((value, d) => (
                                        <TableCell
                                            key={d}
                                            className={`text-right text-xs tabular-nums ${value === 0 ? 'text-muted-foreground' : signClass(value)}`}
                                        >
                                            {value === 0 ? '—' : money(value)}
                                        </TableCell>
                                    ))}
                                    <TableCell
                                        className={`text-right font-semibold tabular-nums ${signClass(w.total)}`}
                                    >
                                        {money(w.total)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Panel>

            <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="Top máquinas con faltante · 30 días">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Máquina</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead className="text-right">
                                    Faltante
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {shortages.length === 0 && (
                                <EmptyRow colSpan={3}>
                                    Sin faltantes registrados.
                                </EmptyRow>
                            )}
                            {shortages.map((s) => (
                                <TableRow key={s.machine_id}>
                                    <TableCell>
                                        <MachineLink id={s.machine_id}>
                                            {s.code}
                                        </MachineLink>
                                        <p className="text-xs text-muted-foreground">
                                            {s.readings}{' '}
                                            {s.readings === 1
                                                ? 'lectura'
                                                : 'lecturas'}
                                        </p>
                                    </TableCell>
                                    <TableCell>{s.client ?? 'Bodega'}</TableCell>
                                    <TableCell className="text-right font-medium text-red-600 tabular-nums dark:text-red-400">
                                        {money(s.difference)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Panel>

                <Panel
                    title="Rendimiento de máquinas · 30 días"
                    actions={
                        <PerformanceThresholdsEditor
                            thresholds={performance.thresholds}
                        />
                    }
                >
                    <div className="grid grid-cols-3 gap-2 p-4 text-center">
                        <Classification
                            label="Excelente"
                            value={performance.excellent}
                            className="text-emerald-600 dark:text-emerald-400"
                        />
                        <Classification
                            label="Bueno"
                            value={performance.good}
                            className="text-sky-600 dark:text-sky-400"
                        />
                        <Classification
                            label="Insuficiente"
                            value={performance.poor}
                            className="text-red-600 dark:text-red-400"
                        />
                    </div>
                    <p className="px-4 pb-3 text-xs text-muted-foreground">
                        {thresholdsSummary(performance.thresholds)} Promedio
                        actual por máquina: {gtq(performance.average)} por
                        semana.
                    </p>
                    {performance.worst.length > 0 && (
                        <ul className="divide-y border-t text-sm">
                            {performance.worst.map((m) => (
                                <li
                                    key={m.machine_id}
                                    className="flex items-center justify-between gap-2 px-4 py-2"
                                >
                                    <span>
                                        <MachineLink id={m.machine_id}>
                                            {m.code}
                                        </MachineLink>
                                        <span className="text-xs text-muted-foreground">
                                            {' '}
                                            · {m.client ?? 'Bodega'}
                                        </span>
                                    </span>
                                    <span
                                        className={`text-right tabular-nums ${signClass(m.weekly)}`}
                                    >
                                        {money(m.weekly)}
                                        <span className="block text-xs text-muted-foreground">
                                            por semana
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <Panel
                title="Cartera y mora · préstamos con más de 15 días sin abono"
                actions={
                    arrears.count > 0 && (
                        <Pill tone="red">
                            {arrears.count} · {money(arrears.balance)}
                        </Pill>
                    )
                }
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Último abono</TableHead>
                            <TableHead className="text-right">Días</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {arrears.loans.length === 0 && (
                            <EmptyRow colSpan={4}>
                                Todos los préstamos tienen abonos recientes.
                            </EmptyRow>
                        )}
                        {arrears.loans.map((loan) => (
                            <TableRow key={loan.id}>
                                <TableCell>
                                    <LoanLink id={loan.id}>
                                        {loan.client}
                                    </LoanLink>
                                    <span className="text-xs text-muted-foreground">
                                        {' '}
                                        · {loan.route}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {loan.last_payment_on
                                        ? date(loan.last_payment_on)
                                        : 'Sin abonos'}
                                </TableCell>
                                <TableCell className="text-right font-medium text-red-600 tabular-nums dark:text-red-400">
                                    {loan.days}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(loan.balance)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Panel>
        </div>
    );
}

function Classification({
    label,
    value,
    className,
}: {
    label: string;
    value: number;
    className: string;
}) {
    return (
        <div className="rounded-lg bg-muted/50 p-3">
            <p
                className={`font-display text-2xl font-semibold tabular-nums ${className}`}
            >
                {value}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}

function MachineLink({
    id,
    children,
}: {
    id: number;
    children: React.ReactNode;
}) {
    const can = useCan();

    return can('machines.view') ? (
        <Link
            href={machines.show(id)}
            className="font-mono text-xs font-medium underline-offset-4 hover:underline"
        >
            {children}
        </Link>
    ) : (
        <span className="font-mono text-xs font-medium">{children}</span>
    );
}

function LoanLink({ id, children }: { id: number; children: React.ReactNode }) {
    const can = useCan();

    return can('loans.view') ? (
        <Link
            href={loans.show(id)}
            className="font-medium underline-offset-4 hover:underline"
        >
            {children}
        </Link>
    ) : (
        <span className="font-medium">{children}</span>
    );
}

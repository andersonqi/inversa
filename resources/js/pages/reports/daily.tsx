import { Head, Link } from '@inertiajs/react';
import { Printer } from 'lucide-react';
import { EmptyRow } from '@/components/app/empty-row';
import { FilterBar, FilterField } from '@/components/app/filter-bar';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { StatCard } from '@/components/app/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { date, money, signClass } from '@/lib/format';
import collections from '@/routes/collections';
import loans from '@/routes/loans';
import reports from '@/routes/reports';
import type { CollectionItem, Expense, IdName, Loan } from '@/types';

type RouteRow = {
    id: number;
    code: string;
    name: string;
    visits: number;
    total_in: string;
    total_out: string;
    net: string;
    client_share: string;
    company_share: string;
    loan_deduction: string;
    cash_delivered: string;
};

type Summary = {
    net: number;
    client_share: number;
    cash_delivered: number;
    loan_payments: number;
    expenses: number;
    loans_issued: number;
    cash_balance: number;
};

const sum = (rows: RouteRow[], key: keyof RouteRow) =>
    rows.reduce((t, r) => t + Number(r[key]), 0);

export default function DailyReport({
    filters,
    offices,
    byRoute,
    expenses,
    loans: issued,
    losing,
    summary,
}: {
    filters: { date: string; office_id: number | null };
    offices: IdName[];
    byRoute: RouteRow[];
    expenses: Expense[];
    loans: Loan[];
    losing: CollectionItem[];
    summary: Summary;
}) {
    return (
        <Page>
            <Head title="Cuadre diario" />
            <PageHeader
                title={`Cuadre diario · ${date(filters.date)}`}
                description="Efectivo neto = recaudo de cortes + abonos directos − gastos − préstamos desembolsados."
                actions={
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer /> Imprimir
                    </Button>
                }
            />

            <FilterBar url={reports.daily().url} className="print:hidden">
                <FilterField label="Fecha">
                    <Input
                        type="date"
                        name="date"
                        defaultValue={filters.date}
                        className="w-44"
                    />
                </FilterField>
                <FilterField label="Oficina">
                    <NativeSelect
                        name="office_id"
                        defaultValue={filters.office_id ?? ''}
                        className="w-52"
                    >
                        <option value="">Todas</option>
                        {offices.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.name}
                            </option>
                        ))}
                    </NativeSelect>
                </FilterField>
            </FilterBar>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard
                    label="Recaudo de cortes"
                    value={money(summary.cash_delivered)}
                    hint={`Neto máquinas ${money(summary.net)}`}
                />
                <StatCard
                    label="Abonos directos"
                    value={money(summary.loan_payments)}
                />
                <StatCard label="Gastos" value={money(summary.expenses)} />
                <StatCard
                    label="Préstamos desembolsados"
                    value={money(summary.loans_issued)}
                />
                <StatCard
                    label="Efectivo neto del día"
                    value={money(summary.cash_balance)}
                    tone={summary.cash_balance < 0 ? 'negative' : 'positive'}
                />
            </div>

            <Panel title="Cortes por ruta">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ruta</TableHead>
                            <TableHead className="text-right">
                                Visitas
                            </TableHead>
                            <TableHead className="text-right">Jugado</TableHead>
                            <TableHead className="text-right">Pagado</TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                            <TableHead className="text-right">
                                Comisión clientes
                            </TableHead>
                            <TableHead className="text-right">
                                Desc. préstamos
                            </TableHead>
                            <TableHead className="text-right">
                                Empresa
                            </TableHead>
                            <TableHead className="text-right">
                                Efectivo
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {byRoute.length === 0 && (
                            <EmptyRow colSpan={9}>
                                No hubo cortes este día.
                            </EmptyRow>
                        )}
                        {byRoute.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>
                                    <Link
                                        href={collections.index({
                                            query: {
                                                route_id: r.id,
                                                from: filters.date,
                                                to: filters.date,
                                            },
                                        })}
                                        className="underline-offset-4 hover:underline"
                                    >
                                        <span className="font-mono text-xs">
                                            {r.code}
                                        </span>{' '}
                                        {r.name}
                                    </Link>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {r.visits}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.total_in)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.total_out)}
                                </TableCell>
                                <TableCell
                                    className={`text-right tabular-nums ${signClass(r.net)}`}
                                >
                                    {money(r.net)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.client_share)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.loan_deduction)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.company_share)}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                    {money(r.cash_delivered)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    {byRoute.length > 0 && (
                        <TableFooter>
                            <TableRow>
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {sum(byRoute, 'visits')}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(sum(byRoute, 'total_in'))}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(sum(byRoute, 'total_out'))}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(sum(byRoute, 'net'))}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(sum(byRoute, 'client_share'))}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(sum(byRoute, 'loan_deduction'))}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(sum(byRoute, 'company_share'))}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(sum(byRoute, 'cash_delivered'))}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </Panel>

            <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="Gastos">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Ruta</TableHead>
                                <TableHead>Registró</TableHead>
                                <TableHead className="text-right">
                                    Monto
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expenses.length === 0 && (
                                <EmptyRow colSpan={4}>Sin gastos.</EmptyRow>
                            )}
                            {expenses.map((e) => (
                                <TableRow key={e.id}>
                                    <TableCell className="max-w-56 truncate">
                                        {e.description ?? e.category}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {e.collection_route?.code ?? '—'}
                                    </TableCell>
                                    <TableCell>{e.user?.name}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {money(e.amount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Panel>

                <div className="space-y-6">
                    <Panel title="Máquinas con pérdida en el día">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Máquina</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead className="text-right">
                                        Neto
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {losing.length === 0 && (
                                    <EmptyRow colSpan={3}>Ninguna.</EmptyRow>
                                )}
                                {losing.map((i) => (
                                    <TableRow key={i.id}>
                                        <TableCell className="font-mono text-xs">
                                            {i.machine?.code}
                                        </TableCell>
                                        <TableCell>
                                            {i.collection?.client?.name}
                                        </TableCell>
                                        <TableCell
                                            className={`text-right tabular-nums ${signClass(i.net)}`}
                                        >
                                            {money(i.net)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Panel>

                    <Panel title="Préstamos desembolsados">
                        <Table>
                            <TableBody>
                                {issued.length === 0 && (
                                    <EmptyRow colSpan={2}>Ninguno.</EmptyRow>
                                )}
                                {issued.map((l) => (
                                    <TableRow key={l.id}>
                                        <TableCell>
                                            <Link
                                                href={loans.show(l.id)}
                                                className="underline-offset-4 hover:underline"
                                            >
                                                #{l.id} · {l.client?.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {money(l.principal)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Panel>
                </div>
            </div>
        </Page>
    );
}

DailyReport.layout = {
    breadcrumbs: [
        { title: 'Reportes', href: reports.index() },
        { title: 'Cuadre diario', href: reports.daily() },
    ],
};

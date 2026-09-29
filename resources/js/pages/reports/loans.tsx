import { Head, Link } from '@inertiajs/react';
import { EmptyRow } from '@/components/app/empty-row';
import { FilterBar, FilterField } from '@/components/app/filter-bar';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Pagination } from '@/components/app/pagination';
import { StatCard } from '@/components/app/stat-card';
import { NativeSelect } from '@/components/ui/native-select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { date, money } from '@/lib/format';
import loans from '@/routes/loans';
import reports from '@/routes/reports';
import type { IdName, Paginated } from '@/types';

type Row = {
    id: number;
    client: string;
    route: string;
    issued_on: string;
    total: number;
    balance: number;
    installment_amount: number;
    frequency: string;
    last_payment_on: string | null;
    arrears: number;
};

export default function LoansReport({
    filters,
    offices,
    rows: page,
    summary,
}: {
    filters: { office_id: number | null };
    offices: IdName[];
    rows: Paginated<Row>;
    summary: {
        count: number;
        balance: number;
        arrears: number;
        in_arrears: number;
    };
}) {
    return (
        <Page>
            <Head title="Cartera y mora" />
            <PageHeader
                title="Cartera y mora"
                description="Préstamos activos ordenados por monto vencido sin pagar."
            />

            <FilterBar url={reports.loans().url}>
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Préstamos activos" value={summary.count} />
                <StatCard
                    label="Cartera total"
                    value={money(summary.balance)}
                />
                <StatCard
                    label="Monto en mora"
                    value={money(summary.arrears)}
                    tone={summary.arrears > 0 ? 'negative' : 'default'}
                />
                <StatCard
                    label="Clientes en mora"
                    value={summary.in_arrears}
                    tone={summary.in_arrears > 0 ? 'warning' : 'default'}
                />
            </div>

            <Panel>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Préstamo</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Desembolso</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Último abono</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                            <TableHead className="text-right">
                                En mora
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && (
                            <EmptyRow colSpan={8}>
                                No hay préstamos activos.
                            </EmptyRow>
                        )}
                        {page.data.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>
                                    <Link
                                        href={loans.show(r.id)}
                                        className="font-mono text-xs underline-offset-4 hover:underline"
                                    >
                                        #{r.id}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    {r.client}{' '}
                                    <span className="text-xs text-muted-foreground">
                                        · {r.route}
                                    </span>
                                </TableCell>
                                <TableCell>{date(r.issued_on)}</TableCell>
                                <TableCell className="text-xs">
                                    {money(r.installment_amount)} ·{' '}
                                    {r.frequency}
                                </TableCell>
                                <TableCell>{date(r.last_payment_on)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.total)}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                    {money(r.balance)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {r.arrears > 0 ? (
                                        <span className="font-medium text-red-600 dark:text-red-400">
                                            {money(r.arrears)}
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination page={page} />
            </Panel>
        </Page>
    );
}

LoansReport.layout = {
    breadcrumbs: [
        { title: 'Reportes', href: reports.index() },
        { title: 'Cartera', href: reports.loans() },
    ],
};

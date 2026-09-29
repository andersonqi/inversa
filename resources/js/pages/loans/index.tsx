import { Head, Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { LoanStatusBadge } from '@/components/app/badges';
import { EmptyRow } from '@/components/app/empty-row';
import { FilterBar, FilterField } from '@/components/app/filter-bar';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Pagination } from '@/components/app/pagination';
import { StatCard } from '@/components/app/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { date, money } from '@/lib/format';
import loans from '@/routes/loans';
import type { Loan, Option, Paginated } from '@/types';

export default function LoansIndex({
    loans: page,
    filters,
    statuses,
    frequencies,
    portfolio,
}: {
    loans: Paginated<Loan>;
    filters: { status: string; search?: string };
    statuses: Option[];
    frequencies: Option[];
    portfolio: { count: number; balance: string };
}) {
    const can = useCan();
    const freq = (value: string) =>
        frequencies.find((f) => f.value === value)?.label ?? value;

    return (
        <Page>
            <Head title="Préstamos" />
            <PageHeader
                title="Préstamos"
                description="Préstamos a clientes con cuotas. Se cobran con abonos o descontándolos de la comisión en cada corte."
                actions={
                    can('loans.manage') && (
                        <Button asChild>
                            <Link href={loans.create()}>
                                <Plus /> Nuevo préstamo
                            </Link>
                        </Button>
                    )
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Préstamos activos" value={portfolio.count} />
                <StatCard
                    label="Cartera por cobrar"
                    value={money(portfolio.balance)}
                />
            </div>

            <Panel>
                <div className="border-b p-4">
                    <FilterBar url={loans.index().url}>
                        <FilterField label="Cliente">
                            <Input
                                name="search"
                                defaultValue={filters.search}
                                placeholder="Nombre o documento"
                                className="w-56"
                            />
                        </FilterField>
                        <FilterField label="Estado">
                            <NativeSelect
                                name="status"
                                defaultValue={filters.status}
                                className="w-40"
                            >
                                <option value="all">Todos</option>
                                {statuses.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </NativeSelect>
                        </FilterField>
                    </FilterBar>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead className="text-right">
                                Capital
                            </TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                            <TableHead className="text-right">
                                En mora
                            </TableHead>
                            <TableHead>Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && <EmptyRow colSpan={9} />}
                        {page.data.map((loan) => (
                            <TableRow key={loan.id}>
                                <TableCell>
                                    <Link
                                        href={loans.show(loan.id)}
                                        className="font-mono text-xs underline-offset-4 hover:underline"
                                    >
                                        #{loan.id}
                                    </Link>
                                </TableCell>
                                <TableCell>{date(loan.issued_on)}</TableCell>
                                <TableCell>
                                    <span className="font-medium">
                                        {loan.client?.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {' '}
                                        · {loan.client?.collection_route?.code}
                                    </span>
                                </TableCell>
                                <TableCell className="text-xs">
                                    {loan.installments} ×{' '}
                                    {money(loan.installment_amount)} ·{' '}
                                    {freq(loan.frequency)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(loan.principal)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(loan.total)}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                    {money(loan.balance)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {(loan.arrears ?? 0) > 0 ? (
                                        <span className="text-red-600 dark:text-red-400">
                                            {money(loan.arrears)}
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                                <TableCell>
                                    <LoanStatusBadge status={loan.status} />
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

LoansIndex.layout = {
    breadcrumbs: [{ title: 'Préstamos', href: loans.index() }],
};

import { Head, Link } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmAction } from '@/components/app/confirm-action';
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
import expenses from '@/routes/expenses';
import type { Expense, IdName, Option, Paginated } from '@/types';

export default function ExpensesIndex({
    expenses: page,
    total,
    byCategory,
    filters,
    offices,
    categories,
}: {
    expenses: Paginated<Expense>;
    total: string | number;
    byCategory: { category: string; total: string }[];
    filters: {
        from: string;
        to: string;
        office_id?: string;
        category?: string;
    };
    offices: IdName[];
    categories: Option[];
}) {
    const can = useCan();
    const label = (value: string) =>
        categories.find((c) => c.value === value)?.label ?? value;

    return (
        <Page>
            <Head title="Gastos" />
            <PageHeader
                title="Gastos"
                description="Egresos de la operación por oficina, ruta o máquina."
                actions={
                    can('expenses.manage') && (
                        <Button asChild>
                            <Link href={expenses.create()}>
                                <Plus /> Registrar gasto
                            </Link>
                        </Button>
                    )
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total del período"
                    value={money(total)}
                    tone="negative"
                />
                {byCategory.slice(0, 3).map((c) => (
                    <StatCard
                        key={c.category}
                        label={label(c.category)}
                        value={money(c.total)}
                    />
                ))}
            </div>

            <Panel>
                <div className="border-b p-4">
                    <FilterBar url={expenses.index().url}>
                        <FilterField label="Desde">
                            <Input
                                type="date"
                                name="from"
                                defaultValue={filters.from}
                                className="w-40"
                            />
                        </FilterField>
                        <FilterField label="Hasta">
                            <Input
                                type="date"
                                name="to"
                                defaultValue={filters.to}
                                className="w-40"
                            />
                        </FilterField>
                        <FilterField label="Oficina">
                            <NativeSelect
                                name="office_id"
                                defaultValue={filters.office_id ?? ''}
                                className="w-48"
                            >
                                <option value="">Todas</option>
                                {offices.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </FilterField>
                        <FilterField label="Categoría">
                            <NativeSelect
                                name="category"
                                defaultValue={filters.category ?? ''}
                                className="w-52"
                            >
                                <option value="">Todas</option>
                                {categories.map((c) => (
                                    <option key={c.value} value={c.value}>
                                        {c.label}
                                    </option>
                                ))}
                            </NativeSelect>
                        </FilterField>
                    </FilterBar>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Oficina</TableHead>
                            <TableHead>Ruta / máquina</TableHead>
                            <TableHead>Registró</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && (
                            <EmptyRow colSpan={8}>
                                No hay gastos en el período.
                            </EmptyRow>
                        )}
                        {page.data.map((e) => (
                            <TableRow key={e.id}>
                                <TableCell>{date(e.spent_on)}</TableCell>
                                <TableCell>{label(e.category)}</TableCell>
                                <TableCell className="max-w-64 truncate">
                                    {e.description ?? '—'}
                                </TableCell>
                                <TableCell>{e.office?.name}</TableCell>
                                <TableCell className="font-mono text-xs">
                                    {[e.collection_route?.code, e.machine?.code]
                                        .filter(Boolean)
                                        .join(' · ') || '—'}
                                </TableCell>
                                <TableCell>{e.user?.name}</TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                    {money(e.amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                    {can('expenses.manage') && (
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <Link
                                                    href={expenses.edit(e.id)}
                                                    aria-label="Editar"
                                                >
                                                    <Pencil />
                                                </Link>
                                            </Button>
                                            <ConfirmAction
                                                url={expenses.destroy(e.id).url}
                                                title="¿Eliminar este gasto?"
                                                trigger={
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Eliminar"
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                }
                                            />
                                        </div>
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

ExpensesIndex.layout = {
    breadcrumbs: [{ title: 'Gastos', href: expenses.index() }],
};

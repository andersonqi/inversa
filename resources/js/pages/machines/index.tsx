import { Head, Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { MachineStatusBadge } from '@/components/app/badges';
import { EmptyRow } from '@/components/app/empty-row';
import { FilterBar, FilterField } from '@/components/app/filter-bar';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Pagination } from '@/components/app/pagination';
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
import { money, num } from '@/lib/format';
import clients from '@/routes/clients';
import machines from '@/routes/machines';
import type { IdName, Machine, Option, Paginated } from '@/types';

export default function MachinesIndex({
    machines: page,
    filters,
    offices,
    statuses,
}: {
    machines: Paginated<Machine>;
    filters: { search?: string; status?: string; office_id?: string };
    offices: IdName[];
    statuses: Option[];
}) {
    const can = useCan();

    return (
        <Page>
            <Head title="Máquinas" />
            <PageHeader
                title="Máquinas"
                description="Inventario de tragamonedas, su ubicación actual y contadores vigentes."
                actions={
                    can('machines.manage') && (
                        <Button asChild>
                            <Link href={machines.create()}>
                                <Plus /> Nueva máquina
                            </Link>
                        </Button>
                    )
                }
            />
            <Panel>
                <div className="border-b p-4">
                    <FilterBar url={machines.index().url}>
                        <FilterField label="Buscar">
                            <Input
                                name="search"
                                defaultValue={filters.search}
                                placeholder="Código, serie, marca"
                                className="w-56"
                            />
                        </FilterField>
                        <FilterField label="Estado">
                            <NativeSelect
                                name="status"
                                defaultValue={filters.status ?? ''}
                                className="w-44"
                            >
                                <option value="">Todos</option>
                                {statuses.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </NativeSelect>
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
                    </FilterBar>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Marca / modelo</TableHead>
                            <TableHead>Oficina</TableHead>
                            <TableHead>Ubicación</TableHead>
                            <TableHead className="text-right">
                                Valor crédito
                            </TableHead>
                            <TableHead className="text-right">
                                Entrada
                            </TableHead>
                            <TableHead className="text-right">Salida</TableHead>
                            <TableHead>Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && <EmptyRow colSpan={8} />}
                        {page.data.map((m) => (
                            <TableRow key={m.id}>
                                <TableCell>
                                    <Link
                                        href={machines.show(m.id)}
                                        className="font-mono text-xs font-medium underline-offset-4 hover:underline"
                                    >
                                        {m.code}
                                    </Link>
                                    {m.serial && (
                                        <p className="text-xs text-muted-foreground">
                                            S/N {m.serial}
                                        </p>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {[m.brand, m.model]
                                        .filter(Boolean)
                                        .join(' ') || '—'}
                                </TableCell>
                                <TableCell>{m.office?.name}</TableCell>
                                <TableCell>
                                    {m.client ? (
                                        <Link
                                            href={clients.show(m.client.id)}
                                            className="underline-offset-4 hover:underline"
                                        >
                                            {m.client.name}
                                            <span className="text-muted-foreground">
                                                {' '}
                                                ·{' '}
                                                {
                                                    m.client.collection_route
                                                        ?.code
                                                }
                                            </span>
                                        </Link>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(m.credit_value)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {num(m.counter_in)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {num(m.counter_out)}
                                </TableCell>
                                <TableCell>
                                    <MachineStatusBadge status={m.status} />
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

MachinesIndex.layout = {
    breadcrumbs: [{ title: 'Máquinas', href: machines.index() }],
};

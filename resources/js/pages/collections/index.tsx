import { Head, Link } from '@inertiajs/react';
import { Plus, Receipt } from 'lucide-react';
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
import { date, money, signClass } from '@/lib/format';
import collections from '@/routes/collections';
import type { Collection, IdName, Paginated } from '@/types';

export default function CollectionsIndex({
    collections: page,
    totals,
    filters,
    routes,
}: {
    collections: Paginated<Collection>;
    totals: {
        count: number;
        net: string;
        client_share: string;
        company_share: string;
        cash_delivered: string;
    };
    filters: { from: string; to: string; route_id?: string; search?: string };
    routes: IdName[];
}) {
    const can = useCan();

    return (
        <Page>
            <Head title="Cortes" />
            <PageHeader
                title="Cortes"
                description="Visitas de cobro: lectura de contadores y liquidación con el cliente. Filtre por fecha para reimprimir cualquier recibo."
                actions={
                    can('collections.create') && (
                        <Button asChild>
                            <Link href={collections.create()}>
                                <Plus /> Registrar corte
                            </Link>
                        </Button>
                    )
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Cortes" value={totals.count} />
                <StatCard
                    label="Ganancia neta"
                    value={money(totals.net)}
                    tone={Number(totals.net) < 0 ? 'negative' : 'default'}
                />
                <StatCard
                    label="Comisiones clientes"
                    value={money(totals.client_share)}
                />
                <StatCard
                    label="Efectivo recaudado"
                    value={money(totals.cash_delivered)}
                    tone="positive"
                />
            </div>

            <Panel>
                <div className="border-b p-4">
                    <FilterBar url={collections.index().url}>
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
                        <FilterField label="Ruta">
                            <NativeSelect
                                name="route_id"
                                defaultValue={filters.route_id ?? ''}
                                className="w-52"
                            >
                                <option value="">Todas</option>
                                {routes.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </FilterField>
                        <FilterField label="Cliente">
                            <Input
                                name="search"
                                defaultValue={filters.search}
                                placeholder="Buscar cliente"
                                className="w-52"
                            />
                        </FilterField>
                    </FilterBar>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Ruta</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Cobrador</TableHead>
                            <TableHead className="text-right">Máq.</TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                            <TableHead className="text-right">
                                Cliente
                            </TableHead>
                            <TableHead className="text-right">
                                Empresa
                            </TableHead>
                            <TableHead className="text-right">
                                Efectivo
                            </TableHead>
                            <TableHead className="text-right">Recibo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && (
                            <EmptyRow colSpan={11}>
                                No hay cortes en el período.
                            </EmptyRow>
                        )}
                        {page.data.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell>
                                    <Link
                                        href={collections.show(c.id)}
                                        className="font-mono text-xs underline-offset-4 hover:underline"
                                    >
                                        #{c.id}
                                    </Link>
                                </TableCell>
                                <TableCell>{date(c.collected_on)}</TableCell>
                                <TableCell className="font-mono text-xs">
                                    {c.collection_route?.code}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {c.client?.name}
                                </TableCell>
                                <TableCell>{c.user?.name}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {c.items_count}
                                </TableCell>
                                <TableCell
                                    className={`text-right tabular-nums ${signClass(c.net)}`}
                                >
                                    {money(c.net)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(c.client_share)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(c.company_share)}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                    {money(c.cash_delivered)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" asChild>
                                        <Link
                                            href={collections.receipt(c.id)}
                                            aria-label={`Recibo del corte #${c.id}`}
                                        >
                                            <Receipt />
                                        </Link>
                                    </Button>
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

CollectionsIndex.layout = {
    breadcrumbs: [{ title: 'Cortes', href: collections.index() }],
};

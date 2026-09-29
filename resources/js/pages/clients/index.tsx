import { Head, Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { ActiveBadge } from '@/components/app/badges';
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
import { money, percent } from '@/lib/format';
import clients from '@/routes/clients';
import type { Client, IdName, Paginated } from '@/types';

export default function ClientsIndex({
    clients: page,
    filters,
    routes,
}: {
    clients: Paginated<Client>;
    filters: { search?: string; route_id?: string };
    routes: IdName[];
}) {
    const can = useCan();

    return (
        <Page>
            <Head title="Clientes" />
            <PageHeader
                title="Clientes"
                description="Locales donde se instalan las máquinas. Cada cliente pertenece a una ruta y recibe un porcentaje de la ganancia."
                actions={
                    can('clients.manage') && (
                        <Button asChild>
                            <Link href={clients.create()}>
                                <Plus /> Nuevo cliente
                            </Link>
                        </Button>
                    )
                }
            />
            <Panel>
                <div className="border-b p-4">
                    <FilterBar url={clients.index().url}>
                        <FilterField label="Buscar">
                            <Input
                                name="search"
                                defaultValue={filters.search}
                                placeholder="Nombre, negocio, documento"
                                className="w-64"
                            />
                        </FilterField>
                        <FilterField label="Ruta">
                            <NativeSelect
                                name="route_id"
                                defaultValue={filters.route_id ?? ''}
                                className="w-56"
                            >
                                <option value="">Todas</option>
                                {routes.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </FilterField>
                    </FilterBar>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ruta</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead className="text-right">
                                Comisión
                            </TableHead>
                            <TableHead className="text-right">
                                Máquinas
                            </TableHead>
                            <TableHead className="text-right">
                                Deuda préstamos
                            </TableHead>
                            <TableHead>Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && <EmptyRow colSpan={8} />}
                        {page.data.map((client) => (
                            <TableRow key={client.id}>
                                <TableCell className="font-mono text-xs">
                                    {client.collection_route?.code}
                                </TableCell>
                                <TableCell>
                                    <Link
                                        href={clients.show(client.id)}
                                        className="font-medium underline-offset-4 hover:underline"
                                    >
                                        {client.name}
                                    </Link>
                                    {client.business_name && (
                                        <p className="text-xs text-muted-foreground">
                                            {client.business_name}
                                        </p>
                                    )}
                                </TableCell>
                                <TableCell>{client.document ?? '—'}</TableCell>
                                <TableCell>{client.phone ?? '—'}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {percent(client.commission_percent)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {client.machines_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {Number(client.loans_balance ?? 0) > 0
                                        ? money(client.loans_balance)
                                        : '—'}
                                </TableCell>
                                <TableCell>
                                    <ActiveBadge active={client.is_active} />
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

ClientsIndex.layout = {
    breadcrumbs: [{ title: 'Clientes', href: clients.index() }],
};

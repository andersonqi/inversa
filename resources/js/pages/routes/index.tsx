import { Head, Link } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ActiveBadge } from '@/components/app/badges';
import { ConfirmAction } from '@/components/app/confirm-action';
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
import clients from '@/routes/clients';
import routes from '@/routes/routes';
import type { CollectionRoute, IdName, Paginated } from '@/types';

export default function RoutesIndex({
    routes: page,
    filters,
    offices,
}: {
    routes: Paginated<CollectionRoute>;
    filters: { search?: string; office_id?: string };
    offices: IdName[];
}) {
    const can = useCan();

    return (
        <Page>
            <Head title="Rutas" />
            <PageHeader
                title="Rutas"
                description="Recorridos de cobro. Cada ruta pertenece a una oficina, tiene un cobrador asignado y agrupa clientes."
                actions={
                    can('routes.manage') && (
                        <Button asChild>
                            <Link href={routes.create()}>
                                <Plus /> Nueva ruta
                            </Link>
                        </Button>
                    )
                }
            />
            <Panel>
                <div className="border-b p-4">
                    <FilterBar url={routes.index().url}>
                        <FilterField label="Buscar">
                            <Input
                                name="search"
                                defaultValue={filters.search}
                                placeholder="Código o nombre"
                                className="w-56"
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
                    </FilterBar>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Oficina</TableHead>
                            <TableHead>Cobrador</TableHead>
                            <TableHead className="text-right">
                                Clientes
                            </TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && <EmptyRow colSpan={7} />}
                        {page.data.map((route) => (
                            <TableRow key={route.id}>
                                <TableCell className="font-mono text-xs">
                                    {route.code}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {route.name}
                                </TableCell>
                                <TableCell>{route.office?.name}</TableCell>
                                <TableCell>
                                    {route.collector?.name ?? (
                                        <span className="text-muted-foreground">
                                            Sin asignar
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    <Link
                                        className="underline-offset-4 hover:underline"
                                        href={clients.index({
                                            query: { route_id: route.id },
                                        })}
                                    >
                                        {route.clients_count}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <ActiveBadge active={route.is_active} />
                                </TableCell>
                                <TableCell className="text-right">
                                    {can('routes.manage') && (
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <Link
                                                    href={routes.edit(route.id)}
                                                    aria-label="Editar"
                                                >
                                                    <Pencil />
                                                </Link>
                                            </Button>
                                            <ConfirmAction
                                                url={
                                                    routes.destroy(route.id).url
                                                }
                                                title={`¿Eliminar la ruta ${route.code}?`}
                                                description="Solo se pueden eliminar rutas sin clientes."
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

RoutesIndex.layout = {
    breadcrumbs: [{ title: 'Rutas', href: routes.index() }],
};

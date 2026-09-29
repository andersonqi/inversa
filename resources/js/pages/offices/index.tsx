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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import offices from '@/routes/offices';
import type { Office, Paginated } from '@/types';

export default function OfficesIndex({
    offices: page,
    filters,
}: {
    offices: Paginated<Office>;
    filters: { search?: string };
}) {
    const can = useCan();

    return (
        <Page>
            <Head title="Oficinas" />
            <PageHeader
                title="Oficinas"
                description="Sedes operativas. Cada oficina agrupa sus rutas, cobradores, máquinas y gastos, y cuadra su propia caja."
                actions={
                    can('offices.manage') && (
                        <Button asChild>
                            <Link href={offices.create()}>
                                <Plus /> Nueva oficina
                            </Link>
                        </Button>
                    )
                }
            />

            <Panel>
                <div className="border-b p-4">
                    <FilterBar url={offices.index().url}>
                        <FilterField label="Buscar">
                            <Input
                                name="search"
                                defaultValue={filters.search}
                                placeholder="Nombre, código o ciudad"
                                className="w-64"
                            />
                        </FilterField>
                    </FilterBar>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Ciudad</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead className="text-right">Rutas</TableHead>
                            <TableHead className="text-right">
                                Máquinas
                            </TableHead>
                            <TableHead className="text-right">
                                Usuarios
                            </TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && <EmptyRow colSpan={9} />}
                        {page.data.map((office) => (
                            <TableRow key={office.id}>
                                <TableCell className="font-mono text-xs">
                                    {office.code}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {office.name}
                                </TableCell>
                                <TableCell>{office.city ?? '—'}</TableCell>
                                <TableCell>{office.phone ?? '—'}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {office.routes_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {office.machines_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {office.users_count}
                                </TableCell>
                                <TableCell>
                                    <ActiveBadge active={office.is_active} />
                                </TableCell>
                                <TableCell className="text-right">
                                    {can('offices.manage') && (
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <Link
                                                    href={offices.edit(
                                                        office.id,
                                                    )}
                                                    aria-label="Editar"
                                                >
                                                    <Pencil />
                                                </Link>
                                            </Button>
                                            <ConfirmAction
                                                url={
                                                    offices.destroy(office.id)
                                                        .url
                                                }
                                                title={`¿Eliminar la oficina ${office.name}?`}
                                                description="Solo se pueden eliminar oficinas sin rutas ni máquinas."
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

OfficesIndex.layout = {
    breadcrumbs: [{ title: 'Oficinas', href: offices.index() }],
};

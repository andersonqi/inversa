import { Head, Link } from '@inertiajs/react';
import { Pencil, Plus, UserX } from 'lucide-react';
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
import users from '@/routes/users';
import type { AppUser, IdName, Paginated } from '@/types';

export default function UsersIndex({
    users: page,
    filters,
    offices,
    roles,
}: {
    users: Paginated<AppUser>;
    filters: { search?: string; office_id?: string; role_id?: string };
    offices: IdName[];
    roles: IdName[];
}) {
    const can = useCan();

    return (
        <Page>
            <Head title="Usuarios" />
            <PageHeader
                title="Usuarios"
                description="Personal con acceso al sistema: administradores, supervisores y cobradores."
                actions={
                    can('users.manage') && (
                        <Button asChild>
                            <Link href={users.create()}>
                                <Plus /> Nuevo usuario
                            </Link>
                        </Button>
                    )
                }
            />
            <Panel>
                <div className="border-b p-4">
                    <FilterBar url={users.index().url}>
                        <FilterField label="Buscar">
                            <Input
                                name="search"
                                defaultValue={filters.search}
                                placeholder="Nombre, correo o teléfono"
                                className="w-64"
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
                        <FilterField label="Rol">
                            <NativeSelect
                                name="role_id"
                                defaultValue={filters.role_id ?? ''}
                                className="w-40"
                            >
                                <option value="">Todos</option>
                                {roles.map((r) => (
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
                            <TableHead>Nombre</TableHead>
                            <TableHead>Correo</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Oficina</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && <EmptyRow colSpan={7} />}
                        {page.data.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                    {user.name}
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.phone ?? '—'}</TableCell>
                                <TableCell>{user.role?.name ?? '—'}</TableCell>
                                <TableCell>
                                    {user.office?.name ?? 'Todas'}
                                </TableCell>
                                <TableCell>
                                    <ActiveBadge active={user.is_active} />
                                </TableCell>
                                <TableCell className="text-right">
                                    {can('users.manage') && (
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <Link
                                                    href={users.edit(user.id)}
                                                    aria-label="Editar"
                                                >
                                                    <Pencil />
                                                </Link>
                                            </Button>
                                            {user.is_active && (
                                                <ConfirmAction
                                                    url={
                                                        users.destroy(user.id)
                                                            .url
                                                    }
                                                    title={`¿Desactivar a ${user.name}?`}
                                                    description="El usuario no podrá ingresar; su historial se conserva."
                                                    confirmLabel="Desactivar"
                                                    trigger={
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Desactivar"
                                                        >
                                                            <UserX />
                                                        </Button>
                                                    }
                                                />
                                            )}
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

UsersIndex.layout = {
    breadcrumbs: [{ title: 'Usuarios', href: users.index() }],
};

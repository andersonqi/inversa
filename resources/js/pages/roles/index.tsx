import { Head, Link } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Pill } from '@/components/app/badges';
import { ConfirmAction } from '@/components/app/confirm-action';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Pagination } from '@/components/app/pagination';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import roles from '@/routes/roles';
import type { Option, Role, Paginated } from '@/types';

export default function RolesIndex({
    roles: page,
    scopes,
}: {
    roles: Paginated<Role>;
    scopes: Option[];
}) {
    const can = useCan();
    const scopeLabel = (value: string) =>
        scopes.find((s) => s.value === value)?.label ?? value;

    return (
        <Page>
            <Head title="Roles" />
            <PageHeader
                title="Roles"
                description="Cada rol define qué módulos puede usar el usuario y qué datos ve (todas las oficinas, su oficina o solo sus rutas)."
                actions={
                    can('roles.manage') && (
                        <Button asChild>
                            <Link href={roles.create()}>
                                <Plus /> Nuevo rol
                            </Link>
                        </Button>
                    )
                }
            />
            <Panel>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Rol</TableHead>
                            <TableHead>Alcance</TableHead>
                            <TableHead className="text-right">
                                Permisos
                            </TableHead>
                            <TableHead className="text-right">
                                Usuarios
                            </TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.map((role) => (
                            <TableRow key={role.id}>
                                <TableCell>
                                    <p className="font-medium">{role.name}</p>
                                    <p className="text-xs whitespace-normal text-muted-foreground">
                                        {role.description}
                                    </p>
                                </TableCell>
                                <TableCell>
                                    <Pill
                                        tone={
                                            role.scope === 'all'
                                                ? 'blue'
                                                : role.scope === 'office'
                                                  ? 'amber'
                                                  : 'gray'
                                        }
                                    >
                                        {scopeLabel(role.scope)}
                                    </Pill>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {role.permissions.length}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {role.users_count}
                                </TableCell>
                                <TableCell className="text-right">
                                    {can('roles.manage') && (
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <Link
                                                    href={roles.edit(role.id)}
                                                    aria-label="Editar"
                                                >
                                                    <Pencil />
                                                </Link>
                                            </Button>
                                            <ConfirmAction
                                                url={roles.destroy(role.id).url}
                                                title={`¿Eliminar el rol ${role.name}?`}
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

RolesIndex.layout = {
    breadcrumbs: [{ title: 'Roles', href: roles.index() }],
};

import { Head, Link } from '@inertiajs/react';
import { Banknote, HandCoins, Pencil, Trash2 } from 'lucide-react';
import {
    ActiveBadge,
    LoanStatusBadge,
    MachineStatusBadge,
} from '@/components/app/badges';
import { ConfirmAction } from '@/components/app/confirm-action';
import { EmptyRow } from '@/components/app/empty-row';
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
import { date, money, num, percent, signClass } from '@/lib/format';
import clients from '@/routes/clients';
import collections from '@/routes/collections';
import loans from '@/routes/loans';
import machines from '@/routes/machines';
import type { Client, Collection, Paginated } from '@/types';

export default function ClientShow({
    client,
    collections: recentPage,
}: {
    client: Client;
    collections: Paginated<Collection>;
}) {
    const can = useCan();
    const route = client.collection_route;

    return (
        <Page>
            <Head title={client.name} />
            <PageHeader
                title={client.name}
                description={
                    <>
                        {client.business_name && <>{client.business_name} · </>}
                        Ruta {route?.code} ({route?.name}) ·{' '}
                        {route?.office?.name}
                        {route?.collector && (
                            <> · Cobrador: {route.collector.name}</>
                        )}
                    </>
                }
                actions={
                    <>
                        {can('collections.create') &&
                            (client.machines?.length ?? 0) > 0 && (
                                <Button asChild>
                                    <Link
                                        href={collections.create({
                                            query: { client_id: client.id },
                                        })}
                                    >
                                        <Banknote /> Registrar corte
                                    </Link>
                                </Button>
                            )}
                        {can('loans.manage') && (
                            <Button variant="outline" asChild>
                                <Link
                                    href={loans.create({
                                        query: { client_id: client.id },
                                    })}
                                >
                                    <HandCoins /> Nuevo préstamo
                                </Link>
                            </Button>
                        )}
                        {can('clients.manage') && (
                            <>
                                <Button variant="outline" size="icon" asChild>
                                    <Link
                                        href={clients.edit(client.id)}
                                        aria-label="Editar"
                                    >
                                        <Pencil />
                                    </Link>
                                </Button>
                                <ConfirmAction
                                    url={clients.destroy(client.id).url}
                                    title={`¿Eliminar a ${client.name}?`}
                                    description="Solo se pueden eliminar clientes sin máquinas, cortes ni préstamos."
                                    trigger={
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            aria-label="Eliminar"
                                        >
                                            <Trash2 />
                                        </Button>
                                    }
                                />
                            </>
                        )}
                    </>
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                <Info
                    label="Estado"
                    value={<ActiveBadge active={client.is_active} />}
                />
                <Info label="Documento" value={client.document ?? '—'} />
                <Info label="Teléfono" value={client.phone ?? '—'} />
                <Info
                    label="Comisión"
                    value={percent(client.commission_percent)}
                />
                <Info
                    label="Pérdida pendiente"
                    value={
                        Number(client.loss_balance) > 0 ? (
                            <span className="text-red-600 dark:text-red-400">
                                {money(client.loss_balance)}
                            </span>
                        ) : (
                            '—'
                        )
                    }
                />
                {client.address && (
                    <Info
                        label="Dirección"
                        value={client.address}
                        className="sm:col-span-2 md:col-span-5"
                    />
                )}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="Máquinas instaladas">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Marca / modelo</TableHead>
                                <TableHead className="text-right">
                                    Entrada
                                </TableHead>
                                <TableHead className="text-right">
                                    Salida
                                </TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {client.machines?.length === 0 && (
                                <EmptyRow colSpan={5}>
                                    Sin máquinas instaladas.
                                </EmptyRow>
                            )}
                            {client.machines?.map((m) => (
                                <TableRow key={m.id}>
                                    <TableCell>
                                        <Link
                                            href={machines.show(m.id)}
                                            className="font-mono text-xs underline-offset-4 hover:underline"
                                        >
                                            {m.code}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        {[m.brand, m.model]
                                            .filter(Boolean)
                                            .join(' ') || '—'}
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
                </Panel>

                <Panel title="Préstamos">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="text-right">
                                    Total
                                </TableHead>
                                <TableHead className="text-right">
                                    Saldo
                                </TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {client.loans?.length === 0 && (
                                <EmptyRow colSpan={4}>Sin préstamos.</EmptyRow>
                            )}
                            {client.loans?.map((loan) => (
                                <TableRow key={loan.id}>
                                    <TableCell>
                                        <Link
                                            href={loans.show(loan.id)}
                                            className="underline-offset-4 hover:underline"
                                        >
                                            {date(loan.issued_on)}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {money(loan.total)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {money(loan.balance)}
                                    </TableCell>
                                    <TableCell>
                                        <LoanStatusBadge status={loan.status} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Panel>
            </div>

            <Panel title="Cortes">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Cobrador</TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                            <TableHead className="text-right">
                                Comisión cliente
                            </TableHead>
                            <TableHead className="text-right">
                                Empresa
                            </TableHead>
                            <TableHead className="text-right">
                                Desc. préstamo
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recentPage.data.length === 0 && (
                            <EmptyRow colSpan={6}>
                                Sin cortes registrados.
                            </EmptyRow>
                        )}
                        {recentPage.data.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell>
                                    <Link
                                        href={collections.show(c.id)}
                                        className="underline-offset-4 hover:underline"
                                    >
                                        {date(c.collected_on)}
                                    </Link>
                                </TableCell>
                                <TableCell>{c.user?.name}</TableCell>
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
                                <TableCell className="text-right tabular-nums">
                                    {Number(c.loan_deduction) > 0
                                        ? money(c.loan_deduction)
                                        : '—'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination page={recentPage} />
            </Panel>
        </Page>
    );
}

function Info({
    label,
    value,
    className,
}: {
    label: string;
    value: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`rounded-xl border bg-card px-4 py-3 ${className ?? ''}`}
        >
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="mt-1 text-sm font-medium">{value}</div>
        </div>
    );
}

ClientShow.layout = {
    breadcrumbs: [
        { title: 'Clientes', href: clients.index() },
        { title: 'Detalle', href: '#' },
    ],
};

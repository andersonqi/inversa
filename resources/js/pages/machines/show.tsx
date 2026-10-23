import { Head, Link } from '@inertiajs/react';
import { Pencil, Trash2 } from 'lucide-react';
import { MachineStatusBadge } from '@/components/app/badges';
import { ConfirmAction } from '@/components/app/confirm-action';
import { EmptyRow } from '@/components/app/empty-row';
import { MachineMoveActions } from '@/components/app/machine-move-actions';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Pagination } from '@/components/app/pagination';
import { StatCard } from '@/components/app/stat-card';
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
import { date, money, num, signClass } from '@/lib/format';
import clients from '@/routes/clients';
import collections from '@/routes/collections';
import machines from '@/routes/machines';
import type {
    CollectionItem,
    Machine,
    MachineMovement,
    MoveClient,
    Paginated,
} from '@/types';

const MOVEMENT_LABELS: Record<MachineMovement['type'], string> = {
    transfer: 'Transferencia',
    warehouse: 'A bodega',
    install: 'Instalación',
};

export default function MachineShow({
    machine,
    readings,
    totals,
    movements,
    moveClients,
}: {
    machine: Machine;
    readings: Paginated<CollectionItem>;
    totals: {
        readings: number;
        amount_in: string;
        amount_out: string;
        net: string;
    };
    movements: MachineMovement[];
    moveClients: MoveClient[];
}) {
    const can = useCan();
    const payout =
        Number(totals.amount_in) > 0
            ? (Number(totals.amount_out) / Number(totals.amount_in)) * 100
            : 0;

    return (
        <Page>
            <Head title={`Máquina ${machine.code}`} />
            <PageHeader
                title={`Máquina ${machine.code}`}
                description={
                    <span className="flex flex-wrap items-center gap-2">
                        <MachineStatusBadge status={machine.status} />
                        {[machine.brand, machine.model]
                            .filter(Boolean)
                            .join(' ')}
                        {machine.serial && <> · S/N {machine.serial}</>}
                        {' · '}
                        {machine.office?.name}
                        {machine.client && (
                            <>
                                {' · en '}
                                <Link
                                    href={clients.show(machine.client.id)}
                                    className="underline underline-offset-4"
                                >
                                    {machine.client.name}
                                </Link>
                            </>
                        )}
                    </span>
                }
                actions={
                    <>
                        <MachineMoveActions
                            machine={machine}
                            clients={moveClients}
                            size="default"
                        />
                        {can('machines.manage') && (
                            <>
                                <Button variant="outline" asChild>
                                    <Link href={machines.edit(machine.id)}>
                                        <Pencil /> Editar / reubicar
                                    </Link>
                                </Button>
                                <ConfirmAction
                                    url={machines.destroy(machine.id).url}
                                    title={`¿Eliminar la máquina ${machine.code}?`}
                                    description="Solo se pueden eliminar máquinas sin cortes; en otro caso márquela como dada de baja."
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Contadores actuales"
                    value={`${num(machine.counter_in)} / ${num(machine.counter_out)}`}
                    hint={`Entrada / salida · crédito ${money(machine.credit_value)}`}
                />
                <StatCard
                    label="Total jugado"
                    value={money(totals.amount_in)}
                    hint={`${totals.readings} cortes`}
                />
                <StatCard
                    label="Total pagado"
                    value={money(totals.amount_out)}
                    hint={`Retorno ${payout.toFixed(1)}%`}
                />
                <StatCard
                    label="Ganancia neta histórica"
                    value={money(totals.net)}
                    tone={Number(totals.net) < 0 ? 'negative' : 'positive'}
                />
            </div>

            <Panel title="Historial de lecturas">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Cobrador</TableHead>
                            <TableHead className="text-right">
                                Entrada
                            </TableHead>
                            <TableHead className="text-right">Salida</TableHead>
                            <TableHead className="text-right">Jugado</TableHead>
                            <TableHead className="text-right">Pagado</TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {readings.data.length === 0 && (
                            <EmptyRow colSpan={8}>
                                Aún no hay cortes para esta máquina.
                            </EmptyRow>
                        )}
                        {readings.data.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>
                                    <Link
                                        href={collections.show(
                                            r.collection!.id,
                                        )}
                                        className="underline-offset-4 hover:underline"
                                    >
                                        {date(r.collection?.collected_on)}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    {r.collection?.client?.name}
                                </TableCell>
                                <TableCell>
                                    {r.collection?.user?.name}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                                    {num(r.previous_in)} → {num(r.current_in)}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                                    {num(r.previous_out)} → {num(r.current_out)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.amount_in)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.amount_out)}
                                </TableCell>
                                <TableCell
                                    className={`text-right font-medium tabular-nums ${signClass(r.net)}`}
                                >
                                    {money(r.net)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination page={readings} />
            </Panel>

            <Panel title="Movimientos">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Movimiento</TableHead>
                            <TableHead>Desde</TableHead>
                            <TableHead>Hacia</TableHead>
                            <TableHead className="text-right">
                                Contadores
                            </TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead>Usuario</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {movements.length === 0 && (
                            <EmptyRow colSpan={7}>
                                Sin movimientos registrados.
                            </EmptyRow>
                        )}
                        {movements.map((mv) => (
                            <TableRow key={mv.id}>
                                <TableCell className="tabular-nums">
                                    {new Date(mv.created_at).toLocaleString(
                                        'es-GT',
                                        {
                                            dateStyle: 'short',
                                            timeStyle: 'short',
                                        },
                                    )}
                                </TableCell>
                                <TableCell>{MOVEMENT_LABELS[mv.type]}</TableCell>
                                <TableCell>
                                    {mv.from_client?.name ?? 'Bodega'}
                                </TableCell>
                                <TableCell>
                                    {mv.to_client?.name ?? 'Bodega'}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                    {num(mv.counter_in)} / {num(mv.counter_out)}
                                </TableCell>
                                <TableCell className="max-w-64 text-xs whitespace-normal">
                                    {mv.reason ?? '—'}
                                </TableCell>
                                <TableCell>{mv.user?.name ?? '—'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Panel>
        </Page>
    );
}

MachineShow.layout = {
    breadcrumbs: [
        { title: 'Máquinas', href: machines.index() },
        { title: 'Detalle', href: '#' },
    ],
};

import { Head, Link } from '@inertiajs/react';
import { Ban } from 'lucide-react';
import { Pill } from '@/components/app/badges';
import { ConfirmAction } from '@/components/app/confirm-action';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { date, money, num, percent, signClass } from '@/lib/format';
import clients from '@/routes/clients';
import collections from '@/routes/collections';
import machines from '@/routes/machines';
import type { Collection } from '@/types';

export default function CollectionShow({
    collection: c,
}: {
    collection: Collection;
}) {
    const can = useCan();

    return (
        <Page className="max-w-5xl">
            <Head title={`Corte #${c.id}`} />
            <PageHeader
                title={`Corte #${c.id} · ${date(c.collected_on)}`}
                description={
                    <>
                        <Link
                            href={clients.show(c.client_id)}
                            className="underline underline-offset-4"
                        >
                            {c.client?.name}
                        </Link>
                        {' · '}Ruta {c.collection_route?.code} ·{' '}
                        {c.office?.name} · Cobrador: {c.user?.name}
                    </>
                }
                actions={
                    can('collections.delete') && (
                        <ConfirmAction
                            url={collections.destroy(c.id).url}
                            title="¿Anular este corte?"
                            description="Se restauran los contadores de las máquinas y se revierte el descuento al préstamo. Solo es posible si no hay cortes posteriores de estas máquinas."
                            confirmLabel="Anular corte"
                            trigger={
                                <Button variant="outline">
                                    <Ban /> Anular
                                </Button>
                            }
                        />
                    )
                }
            />

            <Panel title="Lecturas">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Máquina</TableHead>
                            <TableHead className="text-right">
                                Entrada
                            </TableHead>
                            <TableHead className="text-right">Salida</TableHead>
                            <TableHead className="text-right">
                                Crédito
                            </TableHead>
                            <TableHead className="text-right">Jugado</TableHead>
                            <TableHead className="text-right">Pagado</TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {c.items?.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <Link
                                        href={machines.show(item.machine_id)}
                                        className="font-mono text-xs underline-offset-4 hover:underline"
                                    >
                                        {item.machine?.code}
                                    </Link>
                                    {item.forced && (
                                        <span className="ml-2">
                                            <Pill tone="red">
                                                Corte forzado
                                            </Pill>
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                    {num(item.previous_in)} →{' '}
                                    {num(item.current_in)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                    {num(item.previous_out)} →{' '}
                                    {num(item.current_out)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(item.credit_value)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(item.amount_in)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(item.amount_out)}
                                </TableCell>
                                <TableCell
                                    className={`text-right font-medium tabular-nums ${signClass(item.net)}`}
                                >
                                    {money(item.net)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={4} className="text-right">
                                Totales
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {money(c.total_in)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {money(c.total_out)}
                            </TableCell>
                            <TableCell
                                className={`text-right tabular-nums ${signClass(c.net)}`}
                            >
                                {money(c.net)}
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </Panel>

            <div className="grid gap-6 md:grid-cols-2">
                <Panel title="Liquidación con la pulpería">
                    <dl className="divide-y text-sm">
                        <Row label="Ganancia neta" value={money(c.net)} />
                        <Row
                            label={`Parte de la pulpería (${percent(c.commission_percent)})`}
                            value={money(c.client_share)}
                        />
                        {Number(c.loss_offset) > 0 && (
                            <Row
                                label="Rebaja de pérdida pendiente"
                                value={`− ${money(c.loss_offset)}`}
                            />
                        )}
                        {Number(c.loss_added) > 0 && (
                            <Row
                                label="Pérdida que queda pendiente para la pulpería"
                                value={money(c.loss_added)}
                            />
                        )}
                        <Row
                            label="Descuento a préstamo"
                            value={money(c.loan_deduction)}
                        />
                        <Row
                            label="Efectivo entregado a la pulpería"
                            value={money(c.client_paid)}
                        />
                        <Row
                            label="Parte de la empresa"
                            value={money(c.company_share)}
                        />
                        <Row
                            label="Efectivo entregado en oficina"
                            value={money(c.cash_delivered)}
                            strong
                        />
                    </dl>
                </Panel>
                {c.notes && (
                    <Panel title="Observaciones">
                        <p className="p-4 text-sm whitespace-pre-line">
                            {c.notes}
                        </p>
                    </Panel>
                )}
            </div>
        </Page>
    );
}

function Row({
    label,
    value,
    strong,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className={`flex items-center justify-between px-4 py-2.5 ${strong ? 'bg-muted/50 font-semibold' : ''}`}
        >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
        </div>
    );
}

CollectionShow.layout = {
    breadcrumbs: [
        { title: 'Cortes', href: collections.index() },
        { title: 'Detalle', href: '#' },
    ],
};

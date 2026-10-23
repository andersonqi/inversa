import { Link, router } from '@inertiajs/react';
import {
    Banknote,
    Gamepad2,
    HandCoins,
    LocateFixed,
    MapPin,
    Navigation,
    Receipt,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import type { Tone } from '@/components/app/badges';
import { Pill } from '@/components/app/badges';
import { MachineMoveActions } from '@/components/app/machine-move-actions';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useCan } from '@/hooks/use-can';
import { money, num } from '@/lib/format';
import { dayLabel, googleMapsUrl, wazeUrl } from '@/lib/route-tools';
import { cn } from '@/lib/utils';
import clients from '@/routes/clients';
import collections from '@/routes/collections';
import loans from '@/routes/loans';
import machines from '@/routes/machines';
import type { Client, MoveClient } from '@/types';

export type CycleStatus = 'done' | 'partial' | 'pending' | 'empty';

/**
 * Semáforo del ciclo (semana actual): todas las máquinas instaladas cobradas,
 * solo algunas, ninguna, o cliente sin máquinas instaladas.
 */
export function cycleStatus(client: Client): CycleStatus {
    const installed = client.installed_machines_count ?? 0;
    const collected = client.collected_machines_count ?? 0;

    if (installed === 0) {
        return 'empty';
    }

    if (collected >= installed) {
        return 'done';
    }

    return collected > 0 ? 'partial' : 'pending';
}

export const CYCLE_STATUS: Record<
    CycleStatus,
    { label: string; tone: Tone; card: string }
> = {
    done: {
        label: 'Cobrado',
        tone: 'green',
        card: 'border-emerald-500 bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-500/10',
    },
    partial: {
        label: 'Corte parcial',
        tone: 'amber',
        card: 'border-2 border-amber-400 dark:border-amber-500/70',
    },
    pending: { label: 'Pendiente', tone: 'gray', card: 'bg-card' },
    empty: { label: 'Sin máquinas', tone: 'gray', card: 'bg-card opacity-70' },
};

export function RouteClientCard({
    client,
    moveClients,
}: {
    client: Client;
    moveClients: MoveClient[];
}) {
    const can = useCan();
    const status = cycleStatus(client);
    const meta = CYCLE_STATUS[status];
    const installed = client.installed_machines_count ?? 0;
    const collected = client.collected_machines_count ?? 0;
    const debt = Number(client.loans_balance ?? 0);

    return (
        <article
            className={cn(
                'flex flex-col rounded-xl border text-card-foreground',
                meta.card,
            )}
        >
            <header className="space-y-1 px-4 pt-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <Link
                            href={clients.show(client.id)}
                            className="block truncate font-semibold underline-offset-4 hover:underline"
                        >
                            {client.name}
                        </Link>
                        {client.business_name && (
                            <p className="truncate text-xs text-muted-foreground">
                                {client.business_name}
                            </p>
                        )}
                    </div>
                    <Pill tone={meta.tone}>
                        {meta.label}
                        {installed > 0 && ` ${collected}/${installed}`}
                    </Pill>
                </div>
                <p className="text-xs text-muted-foreground">
                    Ruta {client.collection_route?.code} · #{client.visit_order}{' '}
                    · {dayLabel(client.visit_day)}
                    {!client.is_active && ' · Inactivo'}
                </p>
                {client.address && (
                    <p className="truncate text-xs text-muted-foreground">
                        {client.address}
                    </p>
                )}
                {debt > 0 && (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        Deuda préstamos: {money(debt)}
                    </p>
                )}
            </header>

            <div className="mt-auto grid grid-cols-3 gap-2 p-4">
                {can('collections.create') && installed > 0 && (
                    <Button asChild className="col-span-3 h-11">
                        <Link
                            href={collections.create({
                                query: { client_id: client.id },
                            })}
                        >
                            <Banknote /> Ingreso de datos
                        </Link>
                    </Button>
                )}
                <MachinesAction client={client} moveClients={moveClients} />
                <LoansAction client={client} />
                <LocationAction client={client} />
                {client.week_collection_id ? (
                    <Button variant="outline" className="col-span-3" asChild>
                        <Link
                            href={collections.receipt(
                                client.week_collection_id,
                            )}
                        >
                            <Receipt /> Recibo
                        </Link>
                    </Button>
                ) : (
                    <Button variant="outline" className="col-span-3" disabled>
                        <Receipt /> Sin recibo esta semana
                    </Button>
                )}
            </div>
        </article>
    );
}

/** Botón de acción de la tarjeta; reenvía props para usarse como disparador. */
function ActionButton({
    icon,
    label,
    ...props
}: { icon: ReactNode; label: string } & ComponentProps<typeof Button>) {
    return (
        <Button
            variant="outline"
            className="h-auto flex-col gap-1 px-1 py-2 text-xs"
            {...props}
        >
            {icon}
            {label}
        </Button>
    );
}

function MachinesAction({
    client,
    moveClients,
}: {
    client: Client;
    moveClients: MoveClient[];
}) {
    const can = useCan();
    const list = client.machines ?? [];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <ActionButton icon={<Gamepad2 />} label="Máquinas" />
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Máquinas de {client.name}</DialogTitle>
                <DialogDescription>
                    {list.length} instalada{list.length === 1 ? '' : 's'}.
                </DialogDescription>
                {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Sin máquinas instaladas.
                    </p>
                ) : (
                    <ul className="divide-y rounded-lg border text-sm">
                        {list.map((m) => (
                            <li
                                key={m.id}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                            >
                                <div>
                                    {can('machines.view') ? (
                                        <Link
                                            href={machines.show(m.id)}
                                            className="font-mono font-medium underline-offset-4 hover:underline"
                                        >
                                            {m.code}
                                        </Link>
                                    ) : (
                                        <span className="font-mono font-medium">
                                            {m.code}
                                        </span>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        {[m.brand, m.model]
                                            .filter(Boolean)
                                            .join(' ') || '—'}
                                    </p>
                                </div>
                                <p className="text-right text-xs text-muted-foreground tabular-nums">
                                    In {num(m.counter_in)}
                                    <br />
                                    Out {num(m.counter_out)}
                                </p>
                                <div className="flex w-full justify-end gap-1.5 empty:hidden">
                                    <MachineMoveActions
                                        machine={m}
                                        clients={moveClients}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}

function LoansAction({ client }: { client: Client }) {
    const can = useCan();
    const list = client.active_loans ?? [];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <ActionButton icon={<HandCoins />} label="Préstamos" />
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Préstamos de {client.name}</DialogTitle>
                <DialogDescription>
                    Deuda actual: {money(client.loans_balance ?? 0)}
                </DialogDescription>
                {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Sin préstamos activos.
                    </p>
                ) : (
                    <ul className="divide-y rounded-lg border text-sm">
                        {list.map((loan) => (
                            <li
                                key={loan.id}
                                className="flex items-center justify-between gap-2 px-3 py-2"
                            >
                                <div>
                                    <p className="font-medium">
                                        Préstamo #{loan.id}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Saldo {money(loan.balance)} · cuota{' '}
                                        {money(loan.installment_amount)}
                                    </p>
                                </div>
                                {can('loans.view') && (
                                    <Button size="sm" variant="outline" asChild>
                                        <Link href={loans.show(loan.id)}>
                                            {can('loans.pay')
                                                ? 'Abonar'
                                                : 'Ver'}
                                        </Link>
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                {can('loans.manage') && (
                    <Button asChild>
                        <Link
                            href={loans.create({
                                query: { client_id: client.id },
                            })}
                        >
                            <HandCoins /> Nuevo préstamo
                        </Link>
                    </Button>
                )}
            </DialogContent>
        </Dialog>
    );
}

function LocationAction({ client }: { client: Client }) {
    const can = useCan();
    const [locating, setLocating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const google = googleMapsUrl(client);
    const waze = wazeUrl(client);
    const canUpdate = can('clients.manage') || can('collections.create');

    const saveCurrent = () => {
        if (!('geolocation' in navigator)) {
            setError('Este dispositivo no permite obtener la ubicación.');

            return;
        }

        setLocating(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                router.post(
                    clients.location(client.id).url,
                    {
                        latitude: position.coords.latitude.toFixed(7),
                        longitude: position.coords.longitude.toFixed(7),
                    },
                    {
                        preserveScroll: true,
                        preserveState: true,
                        onFinish: () => setLocating(false),
                    },
                );
            },
            () => {
                setLocating(false);
                setError(
                    'No se pudo obtener la ubicación. Revise que el GPS y el permiso estén activos.',
                );
            },
            { enableHighAccuracy: true, timeout: 15000 },
        );
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <ActionButton icon={<MapPin />} label="Ubicación" />
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Ubicación de {client.name}</DialogTitle>
                <DialogDescription>
                    {client.latitude && client.longitude
                        ? `Coordenada: ${client.latitude}, ${client.longitude}`
                        : client.address
                          ? `Sin coordenada guardada. Dirección: ${client.address}`
                          : 'Sin coordenada ni dirección guardada.'}
                </DialogDescription>
                <div className="grid gap-2 sm:grid-cols-2">
                    {google && (
                        <Button variant="outline" asChild>
                            <a href={google} target="_blank" rel="noreferrer">
                                <MapPin /> Google Maps
                            </a>
                        </Button>
                    )}
                    {waze && (
                        <Button variant="outline" asChild>
                            <a href={waze} target="_blank" rel="noreferrer">
                                <Navigation /> Waze
                            </a>
                        </Button>
                    )}
                </div>
                {canUpdate && (
                    <Button onClick={saveCurrent} disabled={locating}>
                        <LocateFixed />
                        {locating
                            ? 'Obteniendo ubicación…'
                            : 'Guardar mi ubicación actual como la del negocio'}
                    </Button>
                )}
                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}
            </DialogContent>
        </Dialog>
    );
}

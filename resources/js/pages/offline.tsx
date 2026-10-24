import { Head, usePage } from '@inertiajs/react';
import {
    CloudUpload,
    Trash2,
    TriangleAlert,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Tone } from '@/components/app/badges';
import { Pill } from '@/components/app/badges';
import { Field } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { openConflict } from '@/components/offline/offline-manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useOfflineQueue } from '@/hooks/use-offline-queue';
import { useOnline } from '@/hooks/use-online';
import { date } from '@/lib/format';
import {
    deleteQueued,
    getSnapshot,
    offlineSupported,
    putQueued,
    QUEUE_EVENT,
} from '@/lib/offline-store';
import type { QueuedCollection, RouteSnapshot } from '@/lib/offline-store';
import { refreshSnapshot } from '@/lib/offline-sync';
import { dayLabel } from '@/lib/route-tools';
import { CollectionForm } from '@/pages/collections/create';
import { offline } from '@/routes';

const STATUS: Record<QueuedCollection['status'], [string, Tone]> = {
    pending: ['Pendiente', 'blue'],
    conflict: ['En conflicto', 'amber'],
    error: ['Rechazado', 'red'],
};

function dateTime(value: string): string {
    return new Date(value).toLocaleString('es-GT', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
}

/**
 * Trabajo sin conexión: el service worker sirve esta pantalla sin señal. Los clientes,
 * máquinas y contadores salen de los datos de ruta guardados en el teléfono.
 */
export default function OfflinePage() {
    const { auth } = usePage().props;
    const online = useOnline();
    const queue = useOfflineQueue(auth.user.id);
    const [snapshot, setSnapshot] = useState<RouteSnapshot | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [clientId, setClientId] = useState('');
    const [search, setSearch] = useState('');
    const [formKey, setFormKey] = useState(0);

    useEffect(() => {
        if (!offlineSupported()) {
            return;
        }

        let active = true;
        const load = () => {
            void getSnapshot()
                .then((value) => {
                    if (active) {
                        setSnapshot(
                            value && value.user_id === auth.user.id
                                ? value
                                : null,
                        );
                        setLoaded(true);
                    }
                })
                .catch(() => {
                    if (active) {
                        setLoaded(true);
                    }
                });
        };

        load();
        // Guardar un corte actualiza los contadores de la ruta en el teléfono.
        window.addEventListener(QUEUE_EVENT, load);

        return () => {
            active = false;
            window.removeEventListener(QUEUE_EVENT, load);
        };
    }, [auth.user.id]);

    const clients = (snapshot?.clients ?? []).filter((c) =>
        `${c.name} ${c.business_name ?? ''}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
    );
    const client =
        snapshot?.clients.find((c) => String(c.id) === clientId) ?? null;
    const today = new Date().toLocaleDateString('en-CA');

    const download = async () => {
        const value = await refreshSnapshot();
        setSnapshot(value);
    };

    const retry = async (item: QueuedCollection) => {
        await putQueued({
            ...item,
            status: 'pending',
            message: undefined,
            conflict: undefined,
        });
    };

    const discard = async (item: QueuedCollection) => {
        if (
            window.confirm(
                `¿Descartar el corte de ${item.client_name}? No se podrá recuperar.`,
            )
        ) {
            await deleteQueued(item.id);
        }
    };

    return (
        <Page className="max-w-6xl">
            <Head title="Trabajo sin conexión" />
            <PageHeader
                title="Trabajo sin conexión"
                description="Registre cortes sin señal. Se guardan en el teléfono y se envían solos al recuperar la conexión."
                actions={
                    <span
                        className={`flex items-center gap-1.5 text-sm font-medium ${online ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
                    >
                        {online ? (
                            <Wifi className="size-4" />
                        ) : (
                            <WifiOff className="size-4" />
                        )}
                        {online ? 'Con conexión' : 'Sin conexión'}
                    </span>
                }
            />

            {!offlineSupported() && (
                <Panel className="p-4 text-sm text-red-600">
                    Este navegador no permite guardar datos sin conexión.
                </Panel>
            )}

            <Panel title="Cortes guardados en el teléfono">
                {queue.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                        No hay cortes pendientes.
                    </p>
                ) : (
                    <ul className="divide-y">
                        {queue.map((item) => (
                            <li
                                key={item.id}
                                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium">
                                        {item.client_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Fecha {date(item.data.collected_on)} ·
                                        guardado {dateTime(item.saved_at)} ·{' '}
                                        {item.data.items
                                            .map((i) => i.code)
                                            .join(', ')}
                                    </p>
                                    {item.message && (
                                        <p className="text-xs text-red-600 dark:text-red-400">
                                            {item.message}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Pill tone={STATUS[item.status][1]}>
                                        {STATUS[item.status][0]}
                                    </Pill>
                                    {item.status === 'conflict' && (
                                        <Button
                                            size="sm"
                                            onClick={() => openConflict(item.id)}
                                        >
                                            <TriangleAlert /> Resolver
                                        </Button>
                                    )}
                                    {item.status === 'error' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => void retry(item)}
                                        >
                                            <CloudUpload /> Reintentar
                                        </Button>
                                    )}
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label="Descartar"
                                        onClick={() => void discard(item)}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>

            <Panel
                title="Registrar corte sin conexión"
                actions={
                    online && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void download()}
                        >
                            Actualizar datos de la ruta
                        </Button>
                    )
                }
            >
                <div className="grid gap-4 p-4">
                    {loaded && !snapshot ? (
                        <p className="text-sm text-muted-foreground">
                            No hay datos de la ruta guardados en este teléfono.
                            Abra la aplicación con conexión al menos una vez
                            para descargarlos.
                        </p>
                    ) : (
                        snapshot && (
                            <>
                                <p className="text-xs text-muted-foreground">
                                    Datos de la ruta descargados el{' '}
                                    {dateTime(snapshot.generated_at)} ·{' '}
                                    {snapshot.clients.length} clientes.
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Buscar" htmlFor="search">
                                        <Input
                                            id="search"
                                            value={search}
                                            onChange={(e) =>
                                                setSearch(e.target.value)
                                            }
                                            placeholder="Nombre del cliente o negocio"
                                        />
                                    </Field>
                                    <Field label="Cliente" htmlFor="client">
                                        <NativeSelect
                                            id="client"
                                            value={clientId}
                                            onChange={(e) =>
                                                setClientId(e.target.value)
                                            }
                                        >
                                            <option value="" disabled>
                                                Seleccione el cliente a visitar…
                                            </option>
                                            {clients.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.collection_route?.code} ·{' '}
                                                    {c.name} ·{' '}
                                                    {dayLabel(c.visit_day)}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </Field>
                                </div>
                            </>
                        )
                    )}
                </div>
            </Panel>

            {client && (
                <CollectionForm
                    key={`${client.id}-${formKey}`}
                    client={client}
                    today={today}
                    offline
                    onSavedOffline={() => {
                        setClientId('');
                        setFormKey((k) => k + 1);
                    }}
                />
            )}
        </Page>
    );
}

OfflinePage.layout = {
    breadcrumbs: [{ title: 'Trabajo sin conexión', href: offline() }],
};

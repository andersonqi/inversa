import { Link, router, usePage } from '@inertiajs/react';
import { CloudUpload, TriangleAlert, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConflictDialog } from '@/components/offline/conflict-dialog';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useOfflineQueue } from '@/hooks/use-offline-queue';
import { useOnline } from '@/hooks/use-online';
import { listQueue, offlineSupported } from '@/lib/offline-store';
import type { SyncReport } from '@/lib/offline-sync';
import {
    cacheOfflineShell,
    refreshSnapshot,
    registerServiceWorker,
    syncQueue,
} from '@/lib/offline-sync';
import { offline } from '@/routes';
import collections from '@/routes/collections';

/** Evento para abrir el diálogo de conflicto de un corte de la cola (detail = id). */
export const RESOLVE_EVENT = 'offline-resolve';

export function openConflict(id: string): void {
    window.dispatchEvent(new CustomEvent(RESOLVE_EVENT, { detail: id }));
}

function announce(report: SyncReport, manual: boolean) {
    if (report.created > 0) {
        const [first] = report.receipts;

        toast.success(
            report.created === 1
                ? `Se sincronizó el corte de ${first?.client ?? 'un cliente'} guardado sin conexión.`
                : `Se sincronizaron ${report.created} cortes guardados sin conexión.`,
            {
                // Acceso directo al recibo para imprimirlo o enviarlo por WhatsApp.
                action:
                    report.created === 1 && first
                        ? {
                              label: 'Ver recibo',
                              onClick: () => router.visit(first.url),
                          }
                        : {
                              label: 'Ver cortes',
                              onClick: () =>
                                  router.visit(collections.index().url),
                          },
                duration: 10_000,
            },
        );
    }

    if (report.conflicts > 0) {
        toast.warning(
            'Hay cortes en conflicto con otros registrados mientras no había señal.',
        );
    }

    if (report.errors > 0) {
        toast.error('Algunos cortes fueron rechazados; revíselos.');
    }

    if (report.stopped && manual) {
        toast.error(report.stopped);
    }
}

/**
 * Modo sin conexión: registra el service worker, descarga los datos de la ruta al
 * teléfono, sincroniza la cola al recuperar la señal y abre el diálogo de conflictos.
 */
export function OfflineManager() {
    const { auth } = usePage().props;
    const can = useCan();
    const enabled = can('collections.create') && offlineSupported();
    const userId = auth.user.id;
    const online = useOnline();
    const queue = useOfflineQueue(enabled ? userId : undefined);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);

    const pending = queue.filter((i) => i.status === 'pending').length;
    const conflicts = queue.filter((i) => i.status === 'conflict');
    const errors = queue.filter((i) => i.status === 'error').length;
    const resolving = queue.find((i) => i.id === resolvingId) ?? null;

    useEffect(() => {
        if (enabled) {
            registerServiceWorker();
        }
    }, [enabled]);

    // Con señal: datos de ruta frescos, pantalla offline en caché y envío de la cola.
    useEffect(() => {
        if (!enabled || !online) {
            return;
        }

        void refreshSnapshot();
        cacheOfflineShell(offline().url);
        void syncQueue(userId).then(async (report) => {
            announce(report, false);

            if (report.conflicts > 0) {
                const first = (await listQueue()).find(
                    (i) => i.user_id === userId && i.status === 'conflict',
                );
                setResolvingId(first?.id ?? null);
            }
        });
    }, [enabled, online, userId]);

    useEffect(() => {
        const open = (event: Event) =>
            setResolvingId((event as CustomEvent<string>).detail);

        window.addEventListener(RESOLVE_EVENT, open);

        return () => window.removeEventListener(RESOLVE_EVENT, open);
    }, []);

    const syncNow = async () => {
        setSyncing(true);
        const report = await syncQueue(userId);
        setSyncing(false);
        announce(report, true);

        if (report.created > 0) {
            void refreshSnapshot();
        }
    };

    if (!enabled) {
        return null;
    }

    const showBanner =
        !online || pending > 0 || conflicts.length > 0 || errors > 0;

    return (
        <>
            {showBanner && (
                <div
                    role="status"
                    className="mx-4 mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 md:mx-6 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                >
                    {!online && (
                        <span className="flex items-center gap-1.5 font-medium">
                            <WifiOff className="size-4" /> Sin conexión: puede
                            seguir registrando cortes.
                        </span>
                    )}
                    {pending > 0 && (
                        <span className="flex items-center gap-1.5">
                            <CloudUpload className="size-4" />
                            {pending === 1
                                ? '1 corte pendiente de sincronizar'
                                : `${pending} cortes pendientes de sincronizar`}
                        </span>
                    )}
                    {conflicts.length > 0 && (
                        <span className="flex items-center gap-1.5 font-medium">
                            <TriangleAlert className="size-4" />
                            {conflicts.length === 1
                                ? '1 corte en conflicto'
                                : `${conflicts.length} cortes en conflicto`}
                        </span>
                    )}
                    {errors > 0 && (
                        <span>
                            {errors === 1
                                ? '1 corte rechazado'
                                : `${errors} cortes rechazados`}
                        </span>
                    )}
                    <span className="ml-auto flex flex-wrap gap-2">
                        {conflicts.length > 0 && (
                            <Button
                                size="sm"
                                onClick={() => setResolvingId(conflicts[0].id)}
                            >
                                Resolver
                            </Button>
                        )}
                        {online && pending > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={syncing}
                                onClick={() => void syncNow()}
                            >
                                {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
                            </Button>
                        )}
                        {online ? (
                            <Button size="sm" variant="ghost" asChild>
                                <Link href={offline()}>Ver cortes guardados</Link>
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    window.location.assign(offline().url)
                                }
                            >
                                Trabajar sin conexión
                            </Button>
                        )}
                    </span>
                </div>
            )}
            <ConflictDialog
                item={resolving}
                onClose={() => setResolvingId(null)}
            />
        </>
    );
}

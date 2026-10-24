import {
    applyToSnapshot,
    deleteQueued,
    listQueue,
    newOfflineId,
    putQueued,
    saveSnapshot,
} from '@/lib/offline-store';
import type {
    OfflineItem,
    QueuedCollection,
    RouteSnapshot,
    SyncConflict,
} from '@/lib/offline-store';
import collections from '@/routes/collections';
import type { Client } from '@/types';

export type SyncOutcome =
    | { status: 'created'; receipt_url: string }
    | { status: 'conflict'; conflict: SyncConflict }
    | { status: 'error'; message: string }
    /** Sin red o sesión vencida: el corte sigue pendiente. */
    | { status: 'retry'; message: string };

export type SyncReport = {
    created: number;
    conflicts: number;
    errors: number;
    stopped: string | null;
};

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/** Guarda un corte en la cola del teléfono. */
export async function queueCollection(
    userId: number,
    client: Pick<Client, 'id' | 'name'>,
    data: QueuedCollection['data'],
): Promise<QueuedCollection> {
    const item: QueuedCollection = {
        id: newOfflineId(),
        user_id: userId,
        saved_at: new Date().toISOString(),
        client_id: client.id,
        client_name: client.name,
        status: 'pending',
        data,
    };

    await putQueued(item);
    await applyToSnapshot(item);

    return item;
}

function formData(
    item: QueuedCollection,
    replaceIds: number[] | null,
): FormData {
    const fd = new FormData();
    const { data } = item;

    fd.append('offline_id', item.id);
    fd.append('client_id', String(item.client_id));
    fd.append('collected_on', data.collected_on);
    fd.append('notes', data.notes);
    fd.append('signature', data.signature);
    fd.append('loan_id', data.loan_id);
    fd.append(
        'loan_deduction',
        data.loan_id ? data.loan_deduction || '0' : '0',
    );

    data.items.forEach((row: OfflineItem, i) => {
        const key = `items[${i}]`;
        fd.append(`${key}[machine_id]`, String(row.machine_id));
        fd.append(`${key}[base_in]`, String(row.base_in));
        fd.append(`${key}[base_out]`, String(row.base_out));
        fd.append(`${key}[current_in]`, row.current_in);
        fd.append(`${key}[current_out]`, row.current_out);
        fd.append(`${key}[forced]`, row.forced ? '1' : '0');
        fd.append(`${key}[cash_counted]`, row.cash_counted);
        fd.append(`${key}[notes]`, row.notes);

        if (row.photo) {
            fd.append(`${key}[photo]`, row.photo, 'contador.jpg');
        }
    });

    if (replaceIds) {
        fd.append('resolution', 'replace');
        replaceIds.forEach((id) => fd.append('replace_ids[]', String(id)));
    }

    return fd;
}

function firstError(body: unknown): string {
    if (body && typeof body === 'object') {
        const { errors, message } = body as {
            errors?: Record<string, string[]>;
            message?: string;
        };
        const first = errors ? Object.values(errors)[0]?.[0] : undefined;

        if (first) {
            return first;
        }

        if (message) {
            return message;
        }
    }

    return 'El servidor rechazó el corte.';
}

/**
 * Envía un corte de la cola. Con replaceIds se anulan esos cortes registrados en
 * conflicto y se guarda el corte sin conexión.
 */
export async function syncOne(
    item: QueuedCollection,
    replaceIds: number[] | null = null,
): Promise<SyncOutcome> {
    let response: Response;

    try {
        response = await fetch(collections.sync().url, {
            method: 'POST',
            body: formData(item, replaceIds),
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': xsrfToken(),
            },
        });
    } catch {
        return { status: 'retry', message: 'Sin conexión con el servidor.' };
    }

    if (response.status === 401 || response.status === 419) {
        return {
            status: 'retry',
            message: 'Su sesión expiró: inicie sesión para sincronizar.',
        };
    }

    const body: unknown = await response.json().catch(() => null);

    if (response.ok) {
        await deleteQueued(item.id);

        return {
            status: 'created',
            receipt_url: (body as { receipt_url: string }).receipt_url,
        };
    }

    if (response.status === 409) {
        const conflict = body as SyncConflict;
        await putQueued({
            ...item,
            status: 'conflict',
            conflict,
            message: undefined,
        });

        return { status: 'conflict', conflict };
    }

    if (response.status >= 500) {
        return {
            status: 'retry',
            message: 'El servidor no respondió; se reintentará.',
        };
    }

    const message = firstError(body);
    await putQueued({ ...item, status: 'error', message, conflict: undefined });

    return { status: 'error', message };
}

let running: Promise<SyncReport> | null = null;

/**
 * Envía en orden los cortes pendientes del usuario. Los que quedaron en conflicto o con
 * error esperan la decisión del usuario.
 */
export function syncQueue(userId: number): Promise<SyncReport> {
    running ??= (async () => {
        const report: SyncReport = {
            created: 0,
            conflicts: 0,
            errors: 0,
            stopped: null,
        };

        try {
            const queue = await listQueue();

            for (const item of queue) {
                if (item.user_id !== userId || item.status !== 'pending') {
                    continue;
                }

                const outcome = await syncOne(item);

                if (outcome.status === 'retry') {
                    report.stopped = outcome.message;
                    break;
                }

                report[
                    outcome.status === 'created'
                        ? 'created'
                        : outcome.status === 'conflict'
                          ? 'conflicts'
                          : 'errors'
                ]++;
            }
        } finally {
            running = null;
        }

        return report;
    })();

    return running;
}

/** Descarga al teléfono los clientes, máquinas y contadores de la ruta. */
export async function refreshSnapshot(): Promise<RouteSnapshot | null> {
    try {
        const response = await fetch(collections.offline().url, {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (!response.ok) {
            return null;
        }

        const snapshot = (await response.json()) as RouteSnapshot;

        // Los cortes aún pendientes ya movieron los contadores en el teléfono.
        await saveSnapshot(snapshot);

        for (const item of await listQueue()) {
            if (item.user_id === snapshot.user_id && item.status === 'pending') {
                await applyToSnapshot(item);
            }
        }

        return snapshot;
    } catch {
        return null;
    }
}

/** Pide al service worker guardar la pantalla sin conexión y sus archivos. */
export function cacheOfflineShell(url: string): void {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    void navigator.serviceWorker.ready.then((registration) =>
        registration.active?.postMessage({ type: 'cache-offline-shell', url }),
    );
}

export function registerServiceWorker(): void {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
        return;
    }

    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

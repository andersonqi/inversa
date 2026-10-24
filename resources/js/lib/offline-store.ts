import type { Client } from '@/types';

/**
 * Almacenamiento del teléfono para el modo sin conexión (IndexedDB): datos de la ruta
 * descargados y cola de cortes pendientes de sincronizar.
 */

const DB_NAME = 'inversa-offline';
const DB_VERSION = 1;
const META = 'meta';
const QUEUE = 'queue';

/** Evento que se dispara cuando cambia la cola de cortes pendientes. */
export const QUEUE_EVENT = 'offline-queue-changed';

export type RouteSnapshot = {
    user_id: number;
    generated_at: string;
    today: string;
    clients: Client[];
};

export type OfflineItem = {
    machine_id: number;
    code: string;
    credit_value: string;
    /** Contadores "anteriores" que el teléfono tenía al registrar el corte. */
    base_in: number;
    base_out: number;
    current_in: string;
    current_out: string;
    forced: boolean;
    cash_counted: string;
    notes: string;
    photo: Blob | null;
};

export type ConflictMachine = {
    machine_id: number;
    code: string;
    base_in: number;
    base_out: number;
    current_in: number;
    current_out: number;
};

export type CompetingCollection = {
    id: number;
    collected_on: string;
    created_at: string | null;
    client: string;
    user: string;
    net: number;
    can_replace: boolean;
    items: {
        code: string;
        previous_in: number;
        current_in: number;
        previous_out: number;
        current_out: number;
        net: number;
    }[];
};

export type SyncConflict = {
    machines: ConflictMachine[];
    competing: CompetingCollection[];
};

export type QueuedCollection = {
    id: string;
    user_id: number;
    saved_at: string;
    client_id: number;
    client_name: string;
    status: 'pending' | 'conflict' | 'error';
    message?: string;
    conflict?: SyncConflict;
    data: {
        collected_on: string;
        notes: string;
        signature: string;
        loan_id: string;
        loan_deduction: string;
        items: OfflineItem[];
    };
};

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
    opening ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(META)) {
                db.createObjectStore(META);
            }

            if (!db.objectStoreNames.contains(QUEUE)) {
                db.createObjectStore(QUEUE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            opening = null;
            reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
        };
    });

    return opening;
}

async function run<T>(
    store: string,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await open();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = action(tx.objectStore(store));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () =>
            reject(tx.error ?? new Error('Error de almacenamiento local.'));
    });
}

function notify() {
    window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function offlineSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
}

export async function getSnapshot(): Promise<RouteSnapshot | null> {
    const value = await run<RouteSnapshot | undefined>(META, 'readonly', (s) =>
        s.get('snapshot'),
    );

    return value ?? null;
}

export async function saveSnapshot(snapshot: RouteSnapshot): Promise<void> {
    await run(META, 'readwrite', (s) => s.put(snapshot, 'snapshot'));
}

export async function listQueue(): Promise<QueuedCollection[]> {
    const items = await run<QueuedCollection[]>(QUEUE, 'readonly', (s) =>
        s.getAll(),
    );

    return items.sort((a, b) => a.saved_at.localeCompare(b.saved_at));
}

export async function putQueued(item: QueuedCollection): Promise<void> {
    await run(QUEUE, 'readwrite', (s) => s.put(item));
    notify();
}

export async function deleteQueued(id: string): Promise<void> {
    await run(QUEUE, 'readwrite', (s) => s.delete(id));
    notify();
}

/**
 * Deja en los datos de la ruta los contadores del corte guardado sin conexión, para que
 * un segundo corte de la misma máquina parta de ellos.
 */
export async function applyToSnapshot(item: QueuedCollection): Promise<void> {
    const snapshot = await getSnapshot();

    if (!snapshot) {
        return;
    }

    const readings = new Map(item.data.items.map((i) => [i.machine_id, i]));

    snapshot.clients = snapshot.clients.map((client) => ({
        ...client,
        machines: client.machines?.map((machine) => {
            const reading = readings.get(machine.id);

            return reading
                ? {
                      ...machine,
                      counter_in: Number(reading.current_in),
                      counter_out: Number(reading.current_out),
                  }
                : machine;
        }),
    }));

    await saveSnapshot(snapshot);
}

export function newOfflineId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    // Respaldo para navegadores sin randomUUID (contexto no seguro).
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;

        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

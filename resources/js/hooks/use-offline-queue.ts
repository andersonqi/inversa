import { useEffect, useState } from 'react';
import {
    listQueue,
    offlineSupported,
    QUEUE_EVENT,
} from '@/lib/offline-store';
import type { QueuedCollection } from '@/lib/offline-store';

/** Cortes guardados en el teléfono pendientes de sincronizar (del usuario indicado). */
export function useOfflineQueue(userId: number | undefined): QueuedCollection[] {
    const [queue, setQueue] = useState<QueuedCollection[]>([]);

    useEffect(() => {
        if (!offlineSupported() || userId === undefined) {
            return;
        }

        let active = true;
        const load = () => {
            void listQueue()
                .then((items) => {
                    if (active) {
                        setQueue(items.filter((i) => i.user_id === userId));
                    }
                })
                .catch(() => undefined);
        };

        load();
        window.addEventListener(QUEUE_EVENT, load);

        return () => {
            active = false;
            window.removeEventListener(QUEUE_EVENT, load);
        };
    }, [userId]);

    return queue;
}

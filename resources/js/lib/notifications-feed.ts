import { router } from '@inertiajs/react';
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { postJson } from '@/lib/http';
import notifications from '@/routes/notifications';

export type NotificationItem = {
    id: number;
    title: string;
    body: string;
    excerpt: string;
    priority: 'normal' | 'urgent';
    sender: string | null;
    created_at: string | null;
    read_at: string | null;
};

type FeedState = {
    unread: number;
    items: NotificationItem[];
    loaded: boolean;
};

/** Cada cuánto se consultan notificaciones nuevas. */
const POLL_MS = 60_000;

let state: FeedState = { unread: 0, items: [], loaded: false };
const listeners = new Set<() => void>();
let timer: number | null = null;
let lastSeenId: number | null = null;

function emit(next: FeedState) {
    state = next;
    listeners.forEach((listener) => listener());
}

/** Aviso del sistema operativo cuando la app está en segundo plano (si se permitió). */
function systemNotification(item: NotificationItem) {
    if (
        !('Notification' in window) ||
        Notification.permission !== 'granted' ||
        document.visibilityState === 'visible'
    ) {
        return;
    }

    const options: NotificationOptions = {
        body: item.excerpt,
        tag: `aviso-${item.id}`,
        icon: '/apple-touch-icon.png',
        data: { url: notifications.index().url },
    };

    const create = () => new Notification(item.title, options);
    const fallback = () => {
        try {
            create();
        } catch {
            // Algunos navegadores móviles solo permiten avisos desde el service worker.
        }
    };

    if ('serviceWorker' in navigator) {
        void navigator.serviceWorker
            .getRegistration()
            .then((registration) =>
                registration
                    ? registration.showNotification(item.title, options)
                    : fallback(),
            )
            .catch(fallback);
    } else {
        fallback();
    }
}

function announceNew(items: NotificationItem[]) {
    const maxId = Math.max(0, ...items.map((i) => i.id));

    // En la primera consulta solo se toma la referencia, sin avisar lo que ya existía.
    if (lastSeenId === null) {
        lastSeenId = maxId;

        return;
    }

    const seen = lastSeenId;
    const fresh = items.filter((i) => i.id > seen && !i.read_at).reverse();
    lastSeenId = Math.max(seen, maxId);

    for (const item of fresh) {
        const show = item.priority === 'urgent' ? toast.warning : toast.info;

        show(`${item.priority === 'urgent' ? 'Urgente: ' : ''}${item.title}`, {
            description: item.excerpt,
            duration: item.priority === 'urgent' ? 20_000 : 8_000,
            action: {
                label: 'Ver',
                onClick: () => router.visit(notifications.index().url),
            },
        });
        systemNotification(item);
    }
}

export async function refreshFeed(): Promise<void> {
    try {
        const response = await fetch(notifications.feed().url, {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (!response.ok) {
            return;
        }

        const data = (await response.json()) as {
            unread: number;
            items: NotificationItem[];
        };

        announceNew(data.items);
        emit({ unread: data.unread, items: data.items, loaded: true });
    } catch {
        // Sin conexión: se reintenta en la próxima consulta.
    }
}

const onVisible = () => {
    if (document.visibilityState === 'visible') {
        void refreshFeed();
    }
};

function subscribe(listener: () => void) {
    listeners.add(listener);

    if (listeners.size === 1) {
        void refreshFeed();
        timer = window.setInterval(() => void refreshFeed(), POLL_MS);
        document.addEventListener('visibilitychange', onVisible);
    }

    return () => {
        listeners.delete(listener);

        if (listeners.size === 0 && timer !== null) {
            window.clearInterval(timer);
            timer = null;
            document.removeEventListener('visibilitychange', onVisible);
        }
    };
}

export function useNotificationsFeed(): FeedState {
    return useSyncExternalStore(
        subscribe,
        () => state,
        () => state,
    );
}

export async function markRead(id: number): Promise<void> {
    const item = state.items.find((i) => i.id === id);

    if (item && !item.read_at) {
        emit({
            ...state,
            unread: Math.max(0, state.unread - 1),
            items: state.items.map((i) =>
                i.id === id ? { ...i, read_at: new Date().toISOString() } : i,
            ),
        });
    }

    await postJson(notifications.read(id).url);
}

export async function markAllRead(): Promise<void> {
    const now = new Date().toISOString();
    emit({
        ...state,
        unread: 0,
        items: state.items.map((i) => ({ ...i, read_at: i.read_at ?? now })),
    });

    await postJson(notifications.readAll().url);
}

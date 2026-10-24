/*
 * Service worker de Inversa Guatemala: permite abrir la pantalla "Trabajo sin conexión"
 * cuando el cobrador pierde la señal en la ruta.
 *
 * - Archivos compilados (/build/…): se sirven desde la caché (llevan hash en el nombre).
 * - Navegaciones: siempre se intenta la red; sin red se muestra la pantalla sin conexión.
 * - Las peticiones de datos (Inertia, formularios) no se guardan nunca en caché.
 */

const SHELL_CACHE = 'inversa-shell-v1';
const ASSETS_CACHE = 'inversa-assets-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => ![SHELL_CACHE, ASSETS_CACHE].includes(key))
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

async function cacheShell(url) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });

    // Si la sesión venció, la respuesta es el login: no se guarda.
    if (!response.ok || response.redirected) {
        return;
    }

    const html = await response.clone().text();
    const shell = await caches.open(SHELL_CACHE);
    await shell.put(OFFLINE_URL, response);

    // Archivos que la pantalla necesita (scripts, estilos y precargas de Vite).
    const assets = new Set();

    for (const match of html.matchAll(/(?:src|href)="([^"]*\/build\/[^"]+)"/g)) {
        assets.add(new URL(match[1], self.location.origin).href);
    }

    const cache = await caches.open(ASSETS_CACHE);

    await Promise.all(
        [...assets].map(async (asset) => {
            if (!(await cache.match(asset))) {
                try {
                    await cache.add(asset);
                } catch {
                    // Se reintentará en la próxima visita con conexión.
                }
            }
        }),
    );

    // Se descartan archivos de versiones anteriores.
    for (const request of await cache.keys()) {
        if (!assets.has(request.url)) {
            await cache.delete(request);
        }
    }
}

// Al tocar un aviso de notificación se abre (o enfoca) la pantalla de notificaciones.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/notifications';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            for (const client of windows) {
                if ('focus' in client) {
                    client.navigate(url).catch(() => undefined);

                    return client.focus();
                }
            }

            return self.clients.openWindow(url);
        }),
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'cache-offline-shell') {
        event.waitUntil(cacheShell(event.data.url || OFFLINE_URL).catch(() => undefined));
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    if (url.pathname.startsWith('/build/')) {
        event.respondWith(
            caches.open(ASSETS_CACHE).then(async (cache) => {
                const cached = await cache.match(request);

                if (cached) {
                    return cached;
                }

                const response = await fetch(request);

                if (response.ok) {
                    await cache.put(request, response.clone());
                }

                return response;
            }),
        );

        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(async () => {
                const cached = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });

                return (
                    cached ||
                    new Response(
                        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font-family:sans-serif;padding:2rem">Sin conexión. Abra la aplicación con señal al menos una vez para habilitar el modo sin conexión.</p>',
                        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
                    )
                );
            }),
        );
    }
});

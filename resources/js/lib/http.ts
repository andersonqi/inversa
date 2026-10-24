/** Token CSRF de Laravel (cookie XSRF-TOKEN) para peticiones fetch. */
export function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/** POST sin cuerpo que espera JSON. Devuelve si el servidor respondió bien. */
export async function postJson(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': xsrfToken(),
            },
        });

        return response.ok;
    } catch {
        return false;
    }
}

/** "hace 5 min", "ayer", etc. */
export function timeAgo(value: string | null): string {
    if (!value) {
        return '';
    }

    const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
    const format = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];

    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) {
            return format.format(Math.round(seconds / size), unit);
        }
    }

    return 'ahora';
}

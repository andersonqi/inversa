import { useSyncExternalStore } from 'react';

/**
 * Instalación del sistema como app en la pantalla principal del teléfono. Chrome y Edge
 * avisan con el evento "beforeinstallprompt" que se puede instalar; se guarda para
 * mostrar el diálogo nativo al tocar el botón. Safari (iPhone) no lo ofrece: ahí se
 * muestran instrucciones.
 */

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type InstallPlatform = 'ios' | 'android' | 'desktop';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

type InstallState = {
    /** Hay diálogo nativo de instalación disponible. */
    canPrompt: boolean;
    /** Ya se abre como app instalada (o se acaba de instalar). */
    installed: boolean;
};

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = { canPrompt: false, installed: false };
const listeners = new Set<() => void>();

function emit(next: Partial<InstallState>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
}

function runningStandalone(): boolean {
    const iosStandalone =
        (navigator as Navigator & { standalone?: boolean }).standalone === true;

    return (
        iosStandalone ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches
    );
}

/** Se llama una vez al cargar la app, antes de que el navegador avise. */
export function initInstallPrompt(): void {
    if (typeof window === 'undefined') {
        return;
    }

    state = { canPrompt: false, installed: runningStandalone() };

    window.addEventListener('beforeinstallprompt', (event) => {
        // Se evita el aviso automático del navegador: se usa el botón propio.
        event.preventDefault();
        deferred = event as BeforeInstallPromptEvent;
        emit({ canPrompt: true });
    });

    window.addEventListener('appinstalled', () => {
        deferred = null;
        emit({ canPrompt: false, installed: true });
    });
}

export function installPlatform(): InstallPlatform {
    const ua = navigator.userAgent;

    // iPadOS se presenta como Mac, pero con pantalla táctil.
    if (
        /iphone|ipad|ipod/i.test(ua) ||
        (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    ) {
        return 'ios';
    }

    return /android/i.test(ua) ? 'android' : 'desktop';
}

/**
 * Abre el diálogo nativo de instalación. Devuelve "unavailable" si el navegador no lo
 * ofrece (hay que mostrar instrucciones).
 */
export async function promptInstall(): Promise<InstallOutcome> {
    const event = deferred;

    if (!event) {
        return 'unavailable';
    }

    // El evento solo se puede usar una vez.
    deferred = null;
    emit({ canPrompt: false });

    await event.prompt();
    const { outcome } = await event.userChoice;

    if (outcome === 'accepted') {
        emit({ installed: true });
    }

    return outcome;
}

function subscribe(listener: () => void) {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

export function useInstallApp(): InstallState {
    return useSyncExternalStore(
        subscribe,
        () => state,
        () => state,
    );
}

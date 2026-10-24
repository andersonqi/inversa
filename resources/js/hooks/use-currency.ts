import { useSyncExternalStore } from 'react';
import type { CurrencyCode } from '@/lib/format';

const STORAGE_KEY = 'currency';
const listeners = new Set<() => void>();

function stored(): CurrencyCode {
    if (typeof window === 'undefined') {
        return 'GTQ';
    }

    return window.localStorage.getItem(STORAGE_KEY) === 'USD' ? 'USD' : 'GTQ';
}

let current: CurrencyCode = stored();

function subscribe(callback: () => void) {
    listeners.add(callback);

    return () => listeners.delete(callback);
}

/** Moneda elegida por el usuario para ver los montos (se recuerda en el dispositivo). */
export function useCurrency(): {
    currency: CurrencyCode;
    setCurrency: (code: CurrencyCode) => void;
} {
    const currency = useSyncExternalStore(
        subscribe,
        () => current,
        () => 'GTQ' as CurrencyCode,
    );

    const setCurrency = (code: CurrencyCode) => {
        current = code;
        window.localStorage.setItem(STORAGE_KEY, code);
        listeners.forEach((listener) => listener());
    };

    return { currency, setCurrency };
}

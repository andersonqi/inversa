import type { Auth } from '@/types/auth';
import type { ExchangeRateInfo } from '@/types/ui';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            /** Tipo de cambio de referencia: quetzales por 1 US$. */
            exchangeRate?: ExchangeRateInfo | null;
            [key: string]: unknown;
        };
    }
}

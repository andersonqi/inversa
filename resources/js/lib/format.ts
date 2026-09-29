const moneyFormatter = new Intl.NumberFormat('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: 'always',
});

const numberFormatter = new Intl.NumberFormat('es', { useGrouping: 'always' });

/** Símbolo de la moneda de operación: colones. */
export const CURRENCY = '₡';

export function money(value: number | string | null | undefined): string {
    const n = Number(value ?? 0);

    return (n < 0 ? '-' : '') + CURRENCY + moneyFormatter.format(Math.abs(n));
}

export function num(value: number | string | null | undefined): string {
    return numberFormatter.format(Number(value ?? 0));
}

export function percent(value: number | string | null | undefined): string {
    return `${moneyFormatter.format(Number(value ?? 0))}%`;
}

/** Formatea fechas "YYYY-MM-DD" (o ISO) como dd/mm/aaaa sin desfase de zona horaria. */
export function date(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }

    const [y, m, d] = value.slice(0, 10).split('-');

    return `${d}/${m}/${y}`;
}

export function signClass(value: number | string): string {
    const n = Number(value);

    if (n < 0) {
        return 'text-red-600 dark:text-red-400';
    }

    return n > 0 ? 'text-emerald-600 dark:text-emerald-400' : '';
}

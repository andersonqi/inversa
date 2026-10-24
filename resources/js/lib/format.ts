const moneyFormatter = new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: 'always',
});

const numberFormatter = new Intl.NumberFormat('es-GT', {
    useGrouping: 'always',
});

export type CurrencyCode = 'GTQ' | 'USD';

export const CURRENCIES: Record<CurrencyCode, { symbol: string; name: string }> =
    {
        GTQ: { symbol: 'Q', name: 'Quetzal guatemalteco' },
        USD: { symbol: 'US$', name: 'Dólar estadounidense' },
    };

/** Símbolo de la moneda de operación: quetzales (los montos se guardan siempre en Q). */
export const CURRENCY = CURRENCIES.GTQ.symbol;

/** Moneda en que se muestran los montos y quetzales por dólar para convertirlos. */
let display: { code: CurrencyCode; rate: number | null } = {
    code: 'GTQ',
    rate: null,
};

/**
 * Define la moneda de visualización. Sin tipo de cambio disponible se muestra en quetzales.
 * La aplica el layout (ver CurrencyBoundary), que vuelve a dibujar la página al cambiarla.
 */
export function configureCurrency(code: CurrencyCode, rate: number | null) {
    display = { code: code === 'USD' && rate ? 'USD' : 'GTQ', rate };
}

export function displayCurrency(): CurrencyCode {
    return display.code;
}

/**
 * Formatea un monto guardado en quetzales en la moneda de visualización
 * (o en la moneda indicada).
 */
export function money(
    value: number | string | null | undefined,
    currency?: CurrencyCode,
): string {
    let code = currency ?? display.code;
    let n = Number(value ?? 0);

    if (code === 'USD') {
        if (display.rate) {
            n = n / display.rate;
        } else {
            code = 'GTQ';
        }
    }

    return (
        (n < 0 ? '-' : '') +
        CURRENCIES[code].symbol +
        moneyFormatter.format(Math.abs(n))
    );
}

/** Monto siempre en quetzales (formularios, recibos y cortes). */
export function gtq(value: number | string | null | undefined): string {
    return money(value, 'GTQ');
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

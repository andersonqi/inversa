import { router, usePage } from '@inertiajs/react';
import { ChevronDown, Landmark, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrency } from '@/hooks/use-currency';
import type { CurrencyCode } from '@/lib/format';
import { configureCurrency, CURRENCIES, date } from '@/lib/format';
import exchange from '@/routes/exchange';

/**
 * Pantallas donde se registran montos: siempre en quetzales, y cambiar la moneda no
 * debe reiniciar el formulario.
 */
const QUETZAL_ONLY_PAGES = [
    'collections/create',
    'offline',
    'loans/create',
    'loans/show',
    'expenses/form',
    'machines/form',
];

function useQuetzalOnly(): boolean {
    return QUETZAL_ONLY_PAGES.includes(usePage().component);
}

const rateFormatter = new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 5,
});

/**
 * Aplica la moneda elegida a los montos de la página. Al cambiarla se vuelve a dibujar
 * el contenido para que todos los montos se recalculen.
 */
export function CurrencyBoundary({ children }: { children: ReactNode }) {
    const { exchangeRate } = usePage().props;
    const { currency } = useCurrency();
    const quetzalOnly = useQuetzalOnly();
    const rate = exchangeRate?.rate ?? null;
    const code: CurrencyCode =
        !quetzalOnly && currency === 'USD' && rate ? 'USD' : 'GTQ';

    configureCurrency(code, rate);

    return (
        <Fragment key={code === 'USD' ? `USD-${rate}` : 'GTQ'}>
            {children}
        </Fragment>
    );
}

/** Selector de moneda de la cabecera con el tipo de cambio vigente. */
export function CurrencySwitcher() {
    const { exchangeRate } = usePage().props;
    const { currency, setCurrency } = useCurrency();
    const quetzalOnly = useQuetzalOnly();
    const [refreshing, setRefreshing] = useState(false);
    const active: CurrencyCode =
        !quetzalOnly && currency === 'USD' && exchangeRate ? 'USD' : 'GTQ';

    const refresh = () => {
        router.post(
            exchange.refresh().url,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setRefreshing(true),
                onFinish: () => setRefreshing(false),
            },
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    aria-label="Moneda y tipo de cambio"
                >
                    <span className="font-semibold">
                        {CURRENCIES[active].symbol}
                    </span>
                    {exchangeRate && (
                        <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                            1 US$ = Q{rateFormatter.format(exchangeRate.rate)}
                        </span>
                    )}
                    <ChevronDown className="size-3.5 opacity-60" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Ver montos en</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={currency}
                    onValueChange={(value) =>
                        setCurrency(value === 'USD' ? 'USD' : 'GTQ')
                    }
                >
                    <DropdownMenuRadioItem value="GTQ">
                        Q · {CURRENCIES.GTQ.name}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                        value="USD"
                        disabled={!exchangeRate}
                    >
                        US$ · {CURRENCIES.USD.name}
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {quetzalOnly && (
                    <p className="px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                        En esta pantalla los montos se registran y muestran en
                        quetzales.
                    </p>
                )}
                <DropdownMenuSeparator />
                <div className="space-y-1 px-2 py-1.5 text-sm">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Landmark className="size-3.5" /> Tipo de cambio de
                        referencia
                    </p>
                    {exchangeRate ? (
                        <>
                            <p className="font-display text-xl font-semibold tabular-nums">
                                1 US$ = Q
                                {rateFormatter.format(exchangeRate.rate)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Del {date(exchangeRate.date)} ·{' '}
                                {exchangeRate.source}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Sincronizado{' '}
                                {new Date(
                                    exchangeRate.fetched_at,
                                ).toLocaleString('es-GT', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                })}
                            </p>
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Aún no se ha obtenido el tipo de cambio. Pulse
                            «Actualizar ahora».
                        </p>
                    )}
                </div>
                <DropdownMenuItem
                    disabled={refreshing}
                    onSelect={(event) => {
                        event.preventDefault();
                        refresh();
                    }}
                >
                    <RefreshCw className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Actualizando…' : 'Actualizar ahora'}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

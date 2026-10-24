import { Moon, Sun } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

/**
 * El logo de Inversa es el interruptor de modo oscuro / claro: al tocarlo cambia el tema.
 * Una pequeña insignia indica el modo actual.
 */
export function ThemeLogoToggle({ className }: { className?: string }) {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const dark = resolvedAppearance === 'dark';
    const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

    return (
        <button
            type="button"
            onClick={() => updateAppearance(dark ? 'light' : 'dark')}
            aria-label={label}
            aria-pressed={dark}
            title={label}
            className={cn(
                'group relative inline-flex shrink-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95',
                className,
            )}
        >
            <AppLogoIcon
                className={cn(
                    'size-full transition-transform duration-500 group-hover:-rotate-6',
                    dark && 'rotate-[360deg] group-hover:rotate-[354deg]',
                )}
            />
            <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-border">
                {dark ? (
                    <Moon className="size-2.5" />
                ) : (
                    <Sun className="size-2.5" />
                )}
            </span>
        </button>
    );
}

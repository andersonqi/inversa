import { usePage } from '@inertiajs/react';
import { ThemeLogoToggle } from '@/components/theme-logo-toggle';
import type { AuthLayoutProps } from '@/types';

/**
 * Ingreso con la identidad de Inversa: panel de paño verde con la marca y el formulario a la derecha.
 */
export default function AuthBrandLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { name } = usePage().props;

    return (
        <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <aside className="relative hidden overflow-hidden bg-felt-deep text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
                <Reels />
                <div className="relative flex items-center gap-3">
                    <ThemeLogoToggle className="size-10" />
                    <span className="font-display text-2xl font-semibold tracking-tight text-white">
                        {name}
                    </span>
                </div>
                <p className="relative font-display text-4xl leading-[1.05] font-semibold tracking-tight text-white">
                    Gestión de Máquinas
                </p>
            </aside>

            <main className="flex items-center justify-center bg-background p-6 md:p-10">
                <div className="w-full max-w-sm space-y-8">
                    <div className="flex items-center gap-3 lg:hidden">
                        <ThemeLogoToggle className="size-9" />
                        <span className="font-display text-xl font-semibold tracking-tight">
                            {name}
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {title}
                        </h1>
                        {description && (
                            <p className="text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                    {children}
                </div>
            </main>
        </div>
    );
}

/** Rodillos de latón en el fondo del panel, recortados por el borde como una ventana de máquina. */
function Reels() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 300 400"
            preserveAspectRatio="xMaxYMax slice"
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-3/4 text-brass opacity-[0.14]"
        >
            <rect
                x="20"
                y="210"
                width="70"
                height="220"
                rx="18"
                fill="currentColor"
            />
            <rect
                x="115"
                y="140"
                width="70"
                height="290"
                rx="18"
                fill="currentColor"
            />
            <rect
                x="210"
                y="60"
                width="70"
                height="370"
                rx="18"
                fill="currentColor"
            />
        </svg>
    );
}

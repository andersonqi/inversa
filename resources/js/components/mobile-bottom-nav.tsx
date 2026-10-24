import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Banknote, Bell, LayoutGrid, Menu, Store } from 'lucide-react';
import { UnreadBadge } from '@/components/notifications-bell';
import { useSidebar } from '@/components/ui/sidebar';
import { useCan } from '@/hooks/use-can';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useNotificationsFeed } from '@/lib/notifications-feed';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import clients from '@/routes/clients';
import collections from '@/routes/collections';
import notifications from '@/routes/notifications';

/**
 * Barra de navegación inferior en el celular: acceso con el pulgar a lo que más usa el
 * cobrador. El botón central registra un corte.
 */
export function MobileBottomNav() {
    const can = useCan();
    const { setOpenMobile } = useSidebar();
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { unread } = useNotificationsFeed();

    return (
        <nav
            aria-label="Navegación principal"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        >
            <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
                <Item
                    href={dashboard().url}
                    icon={LayoutGrid}
                    label="Inicio"
                    active={isCurrentOrParentUrl(dashboard())}
                />
                {can('clients.view') ? (
                    <Item
                        href={clients.index().url}
                        icon={Store}
                        label="Ruta"
                        active={isCurrentOrParentUrl(clients.index())}
                    />
                ) : (
                    <span />
                )}
                {can('collections.create') ? (
                    <Link
                        href={collections.create()}
                        aria-label="Registrar corte"
                        className="mx-auto -mt-7 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-4 shadow-primary/30 ring-background transition-transform active:scale-95"
                    >
                        <Banknote className="size-6" />
                    </Link>
                ) : (
                    <span />
                )}
                <Item
                    href={notifications.index().url}
                    icon={Bell}
                    label="Avisos"
                    active={isCurrentOrParentUrl(notifications.index())}
                    badge={unread}
                />
                <button
                    type="button"
                    onClick={() => setOpenMobile(true)}
                    className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-muted-foreground"
                >
                    <Menu className="size-5" />
                    Menú
                </button>
            </div>
        </nav>
    );
}

function Item({
    href,
    icon: Icon,
    label,
    active,
    badge = 0,
}: {
    href: string;
    icon: LucideIcon;
    label: string;
    active: boolean;
    badge?: number;
}) {
    return (
        <Link
            href={href}
            className={cn(
                'flex flex-col items-center gap-0.5 text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
            )}
        >
            <span className="relative">
                <Icon className="size-5" />
                <UnreadBadge count={badge} />
            </span>
            {label}
        </Link>
    );
}

import { Link, router } from '@inertiajs/react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { timeAgo } from '@/lib/http';
import {
    markAllRead,
    markRead,
    useNotificationsFeed,
} from '@/lib/notifications-feed';
import { cn } from '@/lib/utils';
import notifications from '@/routes/notifications';

/** Contador de no leídas para insignias (campana y barra inferior). */
export function UnreadBadge({
    count,
    className,
}: {
    count: number;
    className?: string;
}) {
    if (count <= 0) {
        return null;
    }

    return (
        <span
            className={cn(
                'absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-background',
                className,
            )}
        >
            {count > 99 ? '99+' : count}
        </span>
    );
}

export function NotificationsBell() {
    const { unread, items, loaded } = useNotificationsFeed();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={
                        unread > 0
                            ? `Notificaciones: ${unread} sin leer`
                            : 'Notificaciones'
                    }
                >
                    <Bell className={cn(unread > 0 && 'animate-wiggle')} />
                    <UnreadBadge count={unread} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[22rem] p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <p className="text-sm font-semibold">Notificaciones</p>
                    {unread > 0 && (
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            onClick={() => void markAllRead()}
                        >
                            <CheckCheck className="size-3.5" /> Marcar todas
                            como leídas
                        </button>
                    )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {loaded && items.length === 0 && (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                            No tiene notificaciones.
                        </p>
                    )}
                    {!loaded && (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                            Cargando…
                        </p>
                    )}
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                                void markRead(item.id);
                                router.visit(notifications.index().url);
                            }}
                            className={cn(
                                'flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent',
                                !item.read_at && 'bg-primary/5',
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'mt-1.5 size-2 shrink-0 rounded-full',
                                    item.read_at
                                        ? 'bg-transparent'
                                        : item.priority === 'urgent'
                                          ? 'bg-red-600'
                                          : 'bg-primary',
                                )}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            'truncate text-sm',
                                            !item.read_at && 'font-semibold',
                                        )}
                                    >
                                        {item.title}
                                    </span>
                                    {item.priority === 'urgent' && (
                                        <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 uppercase dark:text-red-400">
                                            Urgente
                                        </span>
                                    )}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                                    {item.excerpt}
                                </span>
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                    {item.sender ?? 'Sistema'} ·{' '}
                                    {timeAgo(item.created_at)}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
                <div className="border-t p-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        asChild
                    >
                        <Link href={notifications.index()}>
                            Ver todas las notificaciones
                        </Link>
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

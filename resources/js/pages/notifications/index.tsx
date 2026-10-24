import { Head, router, useForm } from '@inertiajs/react';
import {
    BellRing,
    CheckCheck,
    Megaphone,
    Send,
    Trash2,
    TriangleAlert,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { Pill } from '@/components/app/badges';
import { ConfirmAction } from '@/components/app/confirm-action';
import { Field } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Pagination } from '@/components/app/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { timeAgo } from '@/lib/http';
import type { NotificationItem } from '@/lib/notifications-feed';
import { markAllRead, markRead, refreshFeed } from '@/lib/notifications-feed';
import { cn } from '@/lib/utils';
import notifications from '@/routes/notifications';
import type { Paginated } from '@/types';

type Recipient = {
    id: number;
    name: string;
    role: string | null;
    is_collector: boolean;
};

type SentAnnouncement = {
    id: number;
    title: string;
    body: string;
    priority: 'normal' | 'urgent';
    created_at: string;
    recipients_count: number;
    read_count: number;
    recipients: {
        id: number;
        name: string;
        pivot: { read_at: string | null };
    }[];
};

export default function NotificationsIndex({
    inbox,
    sent,
    recipients,
}: {
    inbox: Paginated<NotificationItem>;
    sent: Paginated<SentAnnouncement> | null;
    recipients: Recipient[];
}) {
    const can = useCan();
    const hasUnread = inbox.data.some((n) => !n.read_at);

    return (
        <Page className="max-w-5xl">
            <Head title="Notificaciones" />
            <PageHeader
                title="Notificaciones"
                description="Avisos de su supervisor u oficina. Revise también la campana de la parte superior."
                actions={
                    <>
                        <DeviceAlertsButton />
                        {hasUnread && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    void markAllRead().then(() => {
                                        router.reload({ only: ['inbox'] });
                                        void refreshFeed();
                                    })
                                }
                            >
                                <CheckCheck /> Marcar todas como leídas
                            </Button>
                        )}
                    </>
                }
            />

            {can('notifications.send') && (
                <SendPanel recipients={recipients} />
            )}

            <Panel title="Recibidas">
                {inbox.data.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                        No ha recibido notificaciones.
                    </p>
                ) : (
                    <ul className="divide-y">
                        {inbox.data.map((item) => (
                            <InboxItem key={item.id} item={item} />
                        ))}
                    </ul>
                )}
                <Pagination page={inbox} />
            </Panel>

            {sent && (
                <Panel title="Enviadas por usted">
                    {sent.data.length === 0 ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            Aún no ha enviado notificaciones.
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {sent.data.map((a) => (
                                <SentItem key={a.id} announcement={a} />
                            ))}
                        </ul>
                    )}
                    <Pagination page={sent} />
                </Panel>
            )}
        </Page>
    );
}

function InboxItem({ item }: { item: NotificationItem }) {
    const unread = !item.read_at;

    return (
        <li
            className={cn(
                'flex gap-4 px-5 py-4',
                unread && 'bg-primary/5',
                item.priority === 'urgent' &&
                    unread &&
                    'bg-red-500/5 dark:bg-red-500/10',
            )}
        >
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    item.priority === 'urgent'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-primary/10 text-primary',
                )}
            >
                {item.priority === 'urgent' ? (
                    <TriangleAlert className="size-5" />
                ) : (
                    <Megaphone className="size-5" />
                )}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p className={cn('text-sm', unread && 'font-semibold')}>
                        {item.title}
                    </p>
                    {item.priority === 'urgent' && (
                        <Pill tone="red">Urgente</Pill>
                    )}
                    {unread && <Pill tone="blue">Nueva</Pill>}
                </div>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {item.body}
                </p>
                <p className="text-xs text-muted-foreground">
                    {item.sender ?? 'Sistema'} · {timeAgo(item.created_at)}
                </p>
            </div>
            {unread && (
                <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 self-start"
                    onClick={() =>
                        void markRead(item.id).then(() => {
                            router.reload({ only: ['inbox'] });
                            void refreshFeed();
                        })
                    }
                >
                    Marcar leída
                </Button>
            )}
        </li>
    );
}

function SentItem({ announcement: a }: { announcement: SentAnnouncement }) {
    const [open, setOpen] = useState(false);
    const allRead = a.recipients_count > 0 && a.read_count === a.recipients_count;

    return (
        <li className="space-y-2 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{a.title}</p>
                        {a.priority === 'urgent' && (
                            <Pill tone="red">Urgente</Pill>
                        )}
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                        {a.body}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {timeAgo(a.created_at)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="text-xs underline-offset-4 hover:underline"
                    >
                        <Pill tone={allRead ? 'green' : 'amber'}>
                            Leída por {a.read_count} de {a.recipients_count}
                        </Pill>
                    </button>
                    <ConfirmAction
                        url={notifications.destroy(a.id).url}
                        title="¿Retirar esta notificación?"
                        description="Se elimina para todos los destinatarios."
                        confirmLabel="Retirar"
                        trigger={
                            <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Retirar notificación"
                            >
                                <Trash2 />
                            </Button>
                        }
                    />
                </div>
            </div>
            {open && (
                <ul className="flex flex-wrap gap-1.5">
                    {a.recipients.map((r) => (
                        <li key={r.id}>
                            <Pill tone={r.pivot.read_at ? 'green' : 'gray'}>
                                {r.pivot.read_at ? '✓ ' : ''}
                                {r.name}
                            </Pill>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

function SendPanel({ recipients }: { recipients: Recipient[] }) {
    const collectors = recipients.filter((r) => r.is_collector);
    const [search, setSearch] = useState('');
    const form = useForm<{
        title: string;
        body: string;
        priority: 'normal' | 'urgent';
        audience: 'collectors' | 'selected';
        recipients: number[];
    }>({
        title: '',
        body: '',
        priority: 'normal',
        audience: collectors.length > 0 ? 'collectors' : 'selected',
        recipients: [],
    });

    const visible = recipients.filter((r) =>
        r.name.toLowerCase().includes(search.trim().toLowerCase()),
    );

    const toggle = (id: number) =>
        form.setData(
            'recipients',
            form.data.recipients.includes(id)
                ? form.data.recipients.filter((r) => r !== id)
                : [...form.data.recipients, id],
        );

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(notifications.store().url, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset('title', 'body', 'recipients');
                void refreshFeed();
            },
        });
    };

    return (
        <Panel title="Enviar notificación">
            <form onSubmit={submit} className="grid gap-5 p-5">
                <Field label="Destinatarios" error={form.errors.recipients}>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <AudienceOption
                            active={form.data.audience === 'collectors'}
                            disabled={collectors.length === 0}
                            onClick={() => form.setData('audience', 'collectors')}
                            title={`Todos mis cobradores (${collectors.length})`}
                            description="Cobradores activos a su cargo."
                        />
                        <AudienceOption
                            active={form.data.audience === 'selected'}
                            onClick={() => form.setData('audience', 'selected')}
                            title="Elegir destinatarios"
                            description={
                                form.data.recipients.length > 0
                                    ? `${form.data.recipients.length} seleccionados`
                                    : 'Seleccione uno o varios usuarios.'
                            }
                        />
                    </div>
                </Field>

                {form.data.audience === 'selected' && (
                    <div className="space-y-2 rounded-xl border p-3">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar usuario"
                            aria-label="Buscar usuario"
                        />
                        <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
                            {visible.length === 0 && (
                                <p className="p-2 text-sm text-muted-foreground">
                                    Sin resultados.
                                </p>
                            )}
                            {visible.map((r) => (
                                <label
                                    key={r.id}
                                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent"
                                >
                                    <input
                                        type="checkbox"
                                        className="size-4 accent-primary"
                                        checked={form.data.recipients.includes(
                                            r.id,
                                        )}
                                        onChange={() => toggle(r.id)}
                                    />
                                    <span className="truncate">{r.name}</span>
                                    {r.role && (
                                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                            {r.role}
                                        </span>
                                    )}
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <Field label="Título" htmlFor="title" error={form.errors.title}>
                    <Input
                        id="title"
                        value={form.data.title}
                        onChange={(e) => form.setData('title', e.target.value)}
                        maxLength={120}
                        placeholder="Ej.: Ruta del jueves adelantada"
                        required
                    />
                </Field>
                <Field label="Mensaje" htmlFor="body" error={form.errors.body}>
                    <Textarea
                        id="body"
                        rows={4}
                        value={form.data.body}
                        onChange={(e) => form.setData('body', e.target.value)}
                        maxLength={2000}
                        placeholder="Escriba el aviso para sus cobradores"
                        required
                    />
                </Field>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="size-4 accent-red-600"
                            checked={form.data.priority === 'urgent'}
                            onChange={(e) =>
                                form.setData(
                                    'priority',
                                    e.target.checked ? 'urgent' : 'normal',
                                )
                            }
                        />
                        <TriangleAlert className="size-4 text-red-600" />
                        Marcar como urgente
                    </label>
                    <Button disabled={form.processing}>
                        <Send /> Enviar notificación
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

function AudienceOption({
    active,
    disabled,
    onClick,
    title,
    description,
}: {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    title: string;
    description: string;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50',
                active
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'hover:bg-accent',
            )}
        >
            <Users
                className={cn(
                    'mt-0.5 size-4 shrink-0',
                    active ? 'text-primary' : 'text-muted-foreground',
                )}
            />
            <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">
                    {description}
                </span>
            </span>
        </button>
    );
}

/** Permiso del navegador para mostrar avisos cuando la app está en segundo plano. */
function DeviceAlertsButton() {
    const supported = typeof window !== 'undefined' && 'Notification' in window;
    const [permission, setPermission] = useState<NotificationPermission>(
        supported ? Notification.permission : 'denied',
    );

    if (!supported || permission === 'granted') {
        return null;
    }

    return (
        <Button
            variant="outline"
            disabled={permission === 'denied'}
            title={
                permission === 'denied'
                    ? 'Los avisos están bloqueados en la configuración del navegador.'
                    : undefined
            }
            onClick={() =>
                void Notification.requestPermission().then(setPermission)
            }
        >
            <BellRing />
            {permission === 'denied'
                ? 'Avisos bloqueados en este dispositivo'
                : 'Activar avisos en este dispositivo'}
        </Button>
    );
}

import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { date, money, num, signClass } from '@/lib/format';
import { deleteQueued } from '@/lib/offline-store';
import type { QueuedCollection } from '@/lib/offline-store';
import { syncOne } from '@/lib/offline-sync';
import { cn } from '@/lib/utils';

function dateTime(value: string | null): string {
    return value
        ? new Date(value).toLocaleString('es-GT', {
              dateStyle: 'short',
              timeStyle: 'short',
          })
        : '—';
}

/**
 * Dos cortes sobre la misma máquina: el registrado en el servidor mientras el teléfono
 * estaba sin señal y el guardado sin conexión. El usuario decide cuál conservar.
 */
export function ConflictDialog({
    item,
    onClose,
}: {
    item: QueuedCollection | null;
    onClose: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const conflict = item?.conflict;
    const competing = conflict?.competing ?? [];
    const canReplace =
        competing.length > 0 && competing.every((c) => c.can_replace);
    const conflictCodes = new Set(conflict?.machines.map((m) => m.code));

    const close = () => {
        setError(null);
        onClose();
    };

    const keepRegistered = async () => {
        if (!item) {
            return;
        }

        setBusy(true);
        await deleteQueued(item.id);
        setBusy(false);
        toast.success(
            'Se conservó el corte registrado; el corte sin conexión se descartó.',
        );
        close();
    };

    const useOffline = async () => {
        if (!item) {
            return;
        }

        setBusy(true);
        setError(null);
        const outcome = await syncOne(item, competing.map((c) => c.id));
        setBusy(false);

        if (outcome.status === 'created') {
            toast.success(
                'Se anuló el corte registrado y se guardó el corte sin conexión.',
            );
            close();
        } else if (outcome.status === 'conflict') {
            setError(
                'La situación cambió mientras decidía (hay otros cortes). Revise de nuevo la comparación.',
            );
        } else {
            setError(outcome.message);
        }
    };

    return (
        <Dialog open={item !== null} onOpenChange={(open) => !open && close()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogTitle className="flex items-center gap-2">
                    <TriangleAlert className="size-5 text-amber-500" />
                    Dos cortes para la misma máquina
                </DialogTitle>
                <DialogDescription>
                    Mientras el teléfono estaba sin señal se registró otro corte
                    en {conflict?.machines.map((m) => m.code).join(', ')}.
                    Elija cuál corte conservar.
                </DialogDescription>

                {item && conflict && (
                    <div className="grid gap-4 md:grid-cols-2">
                        <section className="rounded-lg border p-3">
                            <h3 className="text-sm font-semibold">
                                Corte sin conexión
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {item.client_name} · fecha{' '}
                                {date(item.data.collected_on)} · guardado{' '}
                                {dateTime(item.saved_at)}
                            </p>
                            <Readings
                                rows={item.data.items.map((r) => {
                                    const credit = Number(r.credit_value);
                                    const net =
                                        (Number(r.current_in) - r.base_in) *
                                            credit -
                                        (Number(r.current_out) - r.base_out) *
                                            credit;

                                    return {
                                        code: r.code,
                                        previous_in: r.base_in,
                                        current_in: Number(r.current_in),
                                        previous_out: r.base_out,
                                        current_out: Number(r.current_out),
                                        net,
                                    };
                                })}
                                highlight={conflictCodes}
                            />
                        </section>

                        <section className="space-y-3">
                            {competing.length === 0 ? (
                                <div className="rounded-lg border p-3 text-sm">
                                    No hay un corte con el cual compararlo: los
                                    contadores cambiaron por un movimiento o una
                                    reinstalación de la máquina. Solo puede
                                    descartar el corte sin conexión o dejarlo
                                    pendiente para revisarlo con un supervisor.
                                </div>
                            ) : (
                                competing.map((c) => (
                                    <div
                                        key={c.id}
                                        className="rounded-lg border p-3"
                                    >
                                        <h3 className="text-sm font-semibold">
                                            Corte registrado #{c.id}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            {c.client} · fecha{' '}
                                            {date(c.collected_on)} · por{' '}
                                            {c.user} · {dateTime(c.created_at)}
                                        </p>
                                        <Readings
                                            rows={c.items}
                                            highlight={conflictCodes}
                                        />
                                    </div>
                                ))
                            )}
                        </section>
                    </div>
                )}

                {competing.length > 0 && !canReplace && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        No tiene permiso para anular el corte registrado por
                        otro usuario. Pida a un supervisor que lo anule si el
                        correcto es el corte sin conexión.
                    </p>
                )}
                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={close} disabled={busy}>
                        Decidir después
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => void keepRegistered()}
                        disabled={busy}
                    >
                        {competing.length > 0
                            ? 'Conservar el corte registrado'
                            : 'Descartar el corte sin conexión'}
                    </Button>
                    {competing.length > 0 && (
                        <Button
                            onClick={() => void useOffline()}
                            disabled={busy || !canReplace}
                        >
                            Usar el corte sin conexión
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Readings({
    rows,
    highlight,
}: {
    rows: {
        code: string;
        previous_in: number;
        current_in: number;
        previous_out: number;
        current_out: number;
        net: number;
    }[];
    highlight: Set<string>;
}) {
    const total = rows.reduce((sum, r) => sum + r.net, 0);

    return (
        <div className="mt-2 space-y-1 text-xs">
            {rows.map((r) => (
                <div
                    key={r.code}
                    className={cn(
                        'grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded px-2 py-1',
                        highlight.has(r.code) &&
                            'bg-amber-50 dark:bg-amber-500/10',
                    )}
                >
                    <span className="font-mono font-medium">{r.code}</span>
                    <span className="text-muted-foreground tabular-nums">
                        In {num(r.previous_in)} → {num(r.current_in)} · Out{' '}
                        {num(r.previous_out)} → {num(r.current_out)}
                    </span>
                    <span className={`tabular-nums ${signClass(r.net)}`}>
                        {money(r.net)}
                    </span>
                </div>
            ))}
            <div className="flex justify-between border-t px-2 pt-1 font-semibold">
                <span>Total</span>
                <span className={`tabular-nums ${signClass(total)}`}>
                    {money(total)}
                </span>
            </div>
        </div>
    );
}

import { useForm } from '@inertiajs/react';
import { ArrowRightLeft, PackagePlus, Warehouse } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Field } from '@/components/app/field';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import machines from '@/routes/machines';
import type { Machine, MoveClient } from '@/types';

type MovableMachine = Pick<
    Machine,
    | 'id'
    | 'code'
    | 'status'
    | 'client_id'
    | 'office_id'
    | 'counter_in'
    | 'counter_out'
>;

type Kind = 'transfer' | 'warehouse' | 'install';

const KINDS: Record<
    Kind,
    { title: string; label: string; icon: ReactNode; submit: string }
> = {
    transfer: {
        title: 'Transferir a otro cliente',
        label: 'Transferir',
        icon: <ArrowRightLeft />,
        submit: 'Transferir máquina',
    },
    warehouse: {
        title: 'Mover a central',
        label: 'A central',
        icon: <Warehouse />,
        submit: 'Enviar a bodega',
    },
    install: {
        title: 'Asignar a cliente',
        label: 'Asignar a cliente',
        icon: <PackagePlus />,
        submit: 'Instalar máquina',
    },
};

/**
 * Acciones de logística según el estado de la máquina: instalada → transferir o
 * mover a central; en bodega o mantenimiento → asignar a un cliente.
 */
export function MachineMoveActions({
    machine,
    clients,
    size = 'sm',
}: {
    machine: MovableMachine;
    clients: MoveClient[];
    size?: 'sm' | 'default';
}) {
    const can = useCan();

    if (!can('machines.move')) {
        return null;
    }

    if (machine.status === 'installed' && machine.client_id !== null) {
        return (
            <>
                <MoveDialog
                    kind="transfer"
                    machine={machine}
                    clients={clients}
                    size={size}
                />
                <MoveDialog
                    kind="warehouse"
                    machine={machine}
                    clients={clients}
                    size={size}
                />
            </>
        );
    }

    if (machine.status === 'warehouse' || machine.status === 'maintenance') {
        return (
            <MoveDialog
                kind="install"
                machine={machine}
                clients={clients}
                size={size}
            />
        );
    }

    return null;
}

function MoveDialog({
    kind,
    machine,
    clients,
    size,
}: {
    kind: Kind;
    machine: MovableMachine;
    clients: MoveClient[];
    size: 'sm' | 'default';
}) {
    const [open, setOpen] = useState(false);
    const meta = KINDS[kind];
    const needsClient = kind !== 'warehouse';
    const destinations = clients.filter(
        (c) => c.office_id === machine.office_id && c.id !== machine.client_id,
    );

    const form = useForm({
        client_id: '',
        counter_in: String(machine.counter_in),
        counter_out: String(machine.counter_out),
        reason: '',
    });

    const url = {
        transfer: machines.transfer,
        warehouse: machines.warehouse,
        install: machines.install,
    }[kind](machine.id).url;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(url, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setOpen(false);
            },
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                setOpen(value);

                if (!value) {
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size={size}>
                    {meta.icon} {meta.label}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>
                    {meta.title} · {machine.code}
                </DialogTitle>
                <DialogDescription>
                    {kind === 'install'
                        ? 'Los contadores que lea ahora quedan como punto de partida del próximo corte.'
                        : 'Lea los contadores de la máquina. Deben coincidir con el último corte: si se jugó desde entonces, registre primero el corte en el cliente actual.'}
                </DialogDescription>
                <form onSubmit={submit} className="grid gap-4">
                    {needsClient && (
                        <Field
                            label="Cliente destino"
                            htmlFor={`${kind}-${machine.id}-client`}
                            error={form.errors.client_id}
                        >
                            <NativeSelect
                                id={`${kind}-${machine.id}-client`}
                                value={form.data.client_id}
                                onChange={(e) =>
                                    form.setData('client_id', e.target.value)
                                }
                                required
                            >
                                <option value="" disabled>
                                    {destinations.length === 0
                                        ? 'No hay clientes disponibles'
                                        : 'Seleccione…'}
                                </option>
                                {destinations.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <Field
                            label="Contador entrada"
                            htmlFor={`${kind}-${machine.id}-in`}
                            error={form.errors.counter_in}
                        >
                            <Input
                                id={`${kind}-${machine.id}-in`}
                                type="number"
                                min={0}
                                inputMode="numeric"
                                required
                                value={form.data.counter_in}
                                onChange={(e) =>
                                    form.setData('counter_in', e.target.value)
                                }
                            />
                        </Field>
                        <Field
                            label="Contador salida"
                            htmlFor={`${kind}-${machine.id}-out`}
                            error={form.errors.counter_out}
                        >
                            <Input
                                id={`${kind}-${machine.id}-out`}
                                type="number"
                                min={0}
                                inputMode="numeric"
                                required
                                value={form.data.counter_out}
                                onChange={(e) =>
                                    form.setData('counter_out', e.target.value)
                                }
                            />
                        </Field>
                    </div>
                    <Field
                        label={
                            kind === 'install' ? 'Motivo (opcional)' : 'Motivo'
                        }
                        htmlFor={`${kind}-${machine.id}-reason`}
                        error={form.errors.reason}
                    >
                        <Textarea
                            id={`${kind}-${machine.id}-reason`}
                            rows={2}
                            required={kind !== 'install'}
                            value={form.data.reason}
                            onChange={(e) =>
                                form.setData('reason', e.target.value)
                            }
                            placeholder={
                                kind === 'warehouse'
                                    ? 'Ej.: falla de pantalla, cliente cerró'
                                    : 'Ej.: mejor ubicación, pedido del cliente'
                            }
                        />
                    </Field>
                    <DialogFooter>
                        <Button disabled={form.processing}>
                            {meta.submit}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

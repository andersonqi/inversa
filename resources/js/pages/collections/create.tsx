import { Head, router, useForm } from '@inertiajs/react';
import { Field } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Pill } from '@/components/app/badges';
import { money, num, percent, signClass } from '@/lib/format';
import collections from '@/routes/collections';
import type { Client, IdName } from '@/types';

/**
 * auto: se corta si tiene ganancia y espera si está en pérdida.
 * skip: no se corta esta visita. force: corte forzado de una máquina en pérdida.
 */
type Mode = 'auto' | 'skip' | 'force';

type Item = {
    machine_id: number;
    current_in: string;
    current_out: string;
    mode: Mode;
};

export default function CollectionCreate({
    client,
    clients,
    today,
}: {
    client: Client | null;
    clients: IdName[];
    today: string;
}) {
    return (
        <Page className="max-w-6xl">
            <Head title="Registrar corte" />
            <PageHeader
                title="Registrar corte"
                description="Lea los contadores de cada máquina. Las máquinas en pérdida no se cortan: se espera a que recuperen, salvo que haga un corte forzado."
            />

            <Panel className="p-4">
                <Field label="Cliente" htmlFor="client">
                    <NativeSelect
                        id="client"
                        value={client?.id ?? ''}
                        onChange={(e) =>
                            router.get(
                                collections.create().url,
                                { client_id: e.target.value },
                                { preserveScroll: true },
                            )
                        }
                    >
                        <option value="" disabled>
                            Seleccione el cliente a visitar…
                        </option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>
            </Panel>

            {client && (
                <CollectionForm key={client.id} client={client} today={today} />
            )}
        </Page>
    );
}

function CollectionForm({ client, today }: { client: Client; today: string }) {
    const machines = client.machines ?? [];
    const loans = client.active_loans ?? [];

    const form = useForm<{
        client_id: number;
        collected_on: string;
        notes: string;
        loan_id: string;
        loan_deduction: string;
        items: Item[];
    }>({
        client_id: client.id,
        collected_on: today,
        notes: '',
        loan_id: loans[0] ? String(loans[0].id) : '',
        loan_deduction: '',
        items: machines.map((m) => ({
            machine_id: m.id,
            current_in: '',
            current_out: '',
            mode: 'auto',
        })),
    });

    const rows = machines.map((m, i) => {
        const item = form.data.items[i];
        const credit = Number(m.credit_value);
        const cin =
            item.current_in === '' ? m.counter_in : Number(item.current_in);
        const cout =
            item.current_out === '' ? m.counter_out : Number(item.current_out);
        const amountIn = (cin - m.counter_in) * credit;
        const amountOut = (cout - m.counter_out) * credit;
        const net = amountIn - amountOut;
        const losing = net < 0;
        const skipped =
            item.mode === 'skip' || (losing && item.mode !== 'force');

        return {
            machine: m,
            item,
            amountIn,
            amountOut,
            net,
            losing,
            skipped,
        };
    });

    const cut = rows.filter((r) => !r.skipped);
    // Posición de cada máquina en lo que se envía, para ubicar los errores del servidor.
    const sentIndex = new Map(cut.map((r, i) => [r.machine.id, i]));

    const net = cut.reduce((sum, r) => sum + r.net, 0);
    const pct = Number(client.commission_percent);
    const pendingLoss = Number(client.loss_balance ?? 0);
    const clientShare = Math.round(net * pct) / 100;
    const lossOffset = clientShare > 0 ? Math.min(pendingLoss, clientShare) : 0;
    const lossAdded = clientShare < 0 ? -clientShare : 0;
    const clientEarned = clientShare > 0 ? clientShare - lossOffset : 0;
    const deduction = form.data.loan_id
        ? Number(form.data.loan_deduction || 0)
        : 0;
    const clientPaid = clientEarned - deduction;
    const selectedLoan = loans.find((l) => String(l.id) === form.data.loan_id);

    const setItem = <K extends keyof Item>(
        index: number,
        key: K,
        value: Item[K],
    ) => {
        form.setData(
            'items',
            form.data.items.map((it, i) =>
                i === index ? { ...it, [key]: value } : it,
            ),
        );
    };

    const errors = form.errors as Record<string, string | undefined>;
    const itemError = (machineId: number, field: string) => {
        const index = sentIndex.get(machineId);

        return index === undefined
            ? undefined
            : errors[`items.${index}.${field}`];
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            items: rows
                .filter((r) => !r.skipped)
                .map((r) => ({
                    machine_id: r.machine.id,
                    current_in: r.item.current_in,
                    current_out: r.item.current_out,
                    forced: r.losing && r.item.mode === 'force',
                })),
            loan_id: data.loan_id || null,
            loan_deduction: data.loan_id ? data.loan_deduction || 0 : 0,
        }));
        form.post(collections.store().url);
    };

    return (
        <form onSubmit={submit} className="space-y-6">
            <Panel
                title={`Máquinas de ${client.name} · Ruta ${client.collection_route?.code} · Comisión ${percent(client.commission_percent)}`}
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Máquina</TableHead>
                            <TableHead className="text-right">
                                Entrada anterior
                            </TableHead>
                            <TableHead>Entrada actual</TableHead>
                            <TableHead className="text-right">
                                Salida anterior
                            </TableHead>
                            <TableHead>Salida actual</TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                            <TableHead>Corte</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, i) => {
                            const { machine, item } = row;

                            return (
                                <TableRow
                                    key={machine.id}
                                    className={
                                        row.skipped
                                            ? 'bg-muted/40 align-top'
                                            : 'align-top'
                                    }
                                >
                                    <TableCell>
                                        <p className="font-mono text-xs font-medium">
                                            {machine.code}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Crédito{' '}
                                            {money(machine.credit_value)}
                                        </p>
                                        <InputError
                                            message={itemError(
                                                machine.id,
                                                'machine_id',
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground tabular-nums">
                                        {num(machine.counter_in)}
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            min={machine.counter_in}
                                            required={item.mode !== 'skip'}
                                            inputMode="numeric"
                                            className="w-32"
                                            value={item.current_in}
                                            onChange={(e) =>
                                                setItem(
                                                    i,
                                                    'current_in',
                                                    e.target.value,
                                                )
                                            }
                                            aria-invalid={
                                                !!itemError(
                                                    machine.id,
                                                    'current_in',
                                                )
                                            }
                                        />
                                        <InputError
                                            className="max-w-40 text-xs whitespace-normal"
                                            message={itemError(
                                                machine.id,
                                                'current_in',
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground tabular-nums">
                                        {num(machine.counter_out)}
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            min={machine.counter_out}
                                            required={item.mode !== 'skip'}
                                            inputMode="numeric"
                                            className="w-32"
                                            value={item.current_out}
                                            onChange={(e) =>
                                                setItem(
                                                    i,
                                                    'current_out',
                                                    e.target.value,
                                                )
                                            }
                                            aria-invalid={
                                                !!itemError(
                                                    machine.id,
                                                    'current_out',
                                                )
                                            }
                                        />
                                        <InputError
                                            className="max-w-40 text-xs whitespace-normal"
                                            message={itemError(
                                                machine.id,
                                                'current_out',
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell
                                        className={`text-right font-medium tabular-nums ${signClass(row.net)}`}
                                    >
                                        {money(row.net)}
                                        <p className="text-xs font-normal text-muted-foreground">
                                            {money(row.amountIn)} −{' '}
                                            {money(row.amountOut)}
                                        </p>
                                    </TableCell>
                                    <TableCell className="space-y-1.5">
                                        {row.losing ? (
                                            <>
                                                <Pill tone="red">
                                                    En pérdida
                                                </Pill>
                                                <NativeSelect
                                                    aria-label={`Corte de ${machine.code}`}
                                                    className="w-44"
                                                    value={
                                                        item.mode === 'force'
                                                            ? 'force'
                                                            : 'auto'
                                                    }
                                                    onChange={(e) =>
                                                        setItem(
                                                            i,
                                                            'mode',
                                                            e.target
                                                                .value as Mode,
                                                        )
                                                    }
                                                >
                                                    <option value="auto">
                                                        Esperar a que recupere
                                                    </option>
                                                    <option value="force">
                                                        Corte forzado
                                                    </option>
                                                </NativeSelect>
                                            </>
                                        ) : (
                                            <NativeSelect
                                                aria-label={`Corte de ${machine.code}`}
                                                className="w-44"
                                                value={
                                                    item.mode === 'skip'
                                                        ? 'skip'
                                                        : 'auto'
                                                }
                                                onChange={(e) =>
                                                    setItem(
                                                        i,
                                                        'mode',
                                                        e.target.value as Mode,
                                                    )
                                                }
                                            >
                                                <option value="auto">
                                                    Cortar
                                                </option>
                                                <option value="skip">
                                                    No cortar
                                                </option>
                                            </NativeSelect>
                                        )}
                                        <InputError
                                            className="max-w-44 text-xs whitespace-normal"
                                            message={itemError(
                                                machine.id,
                                                'forced',
                                            )}
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={5} className="text-right">
                                Ganancia neta del corte ({cut.length} de{' '}
                                {rows.length} máquinas)
                            </TableCell>
                            <TableCell
                                className={`text-right tabular-nums ${signClass(net)}`}
                            >
                                {money(net)}
                            </TableCell>
                            <TableCell />
                        </TableRow>
                    </TableFooter>
                </Table>
                <InputError className="px-4 pb-3" message={errors.items} />
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Datos del corte">
                    <div className="grid gap-5 p-4">
                        <Field
                            label="Fecha"
                            htmlFor="collected_on"
                            error={form.errors.collected_on}
                        >
                            <Input
                                id="collected_on"
                                type="date"
                                max={today}
                                value={form.data.collected_on}
                                onChange={(e) =>
                                    form.setData('collected_on', e.target.value)
                                }
                            />
                        </Field>

                        {loans.length > 0 && (
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field
                                    label="Préstamo a descontar"
                                    htmlFor="loan_id"
                                    error={form.errors.loan_id}
                                >
                                    <NativeSelect
                                        id="loan_id"
                                        value={form.data.loan_id}
                                        onChange={(e) =>
                                            form.setData(
                                                'loan_id',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">No descontar</option>
                                        {loans.map((l) => (
                                            <option key={l.id} value={l.id}>
                                                Préstamo #{l.id} · saldo{' '}
                                                {money(l.balance)}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                {form.data.loan_id && (
                                    <Field
                                        label="Descuento de la comisión"
                                        htmlFor="loan_deduction"
                                        error={form.errors.loan_deduction}
                                        hint={
                                            selectedLoan
                                                ? `Cuota: ${money(selectedLoan.installment_amount)}`
                                                : undefined
                                        }
                                    >
                                        <Input
                                            id="loan_deduction"
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            max={Math.min(
                                                clientEarned,
                                                Number(
                                                    selectedLoan?.balance ?? 0,
                                                ),
                                            )}
                                            value={form.data.loan_deduction}
                                            onChange={(e) =>
                                                form.setData(
                                                    'loan_deduction',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                )}
                            </div>
                        )}

                        <Field
                            label="Observaciones"
                            htmlFor="notes"
                            error={form.errors.notes}
                        >
                            <Textarea
                                id="notes"
                                value={form.data.notes}
                                onChange={(e) =>
                                    form.setData('notes', e.target.value)
                                }
                                placeholder="Novedades de las máquinas o del local"
                            />
                        </Field>
                    </div>
                </Panel>

                <Panel title="Liquidación con la pulpería">
                    <dl className="divide-y text-sm">
                        <Row
                            label="Ganancia neta"
                            value={money(net)}
                            className={signClass(net)}
                        />
                        <Row
                            label={`Parte de la pulpería (${percent(pct)})`}
                            value={money(clientShare)}
                            className={signClass(clientShare)}
                        />
                        {pendingLoss > 0 && (
                            <Row
                                label={`Rebaja de pérdida pendiente (${money(pendingLoss)})`}
                                value={`− ${money(lossOffset)}`}
                            />
                        )}
                        {deduction > 0 && (
                            <Row
                                label="Descuento a préstamo"
                                value={`− ${money(deduction)}`}
                            />
                        )}
                        <Row
                            label="Efectivo para la pulpería"
                            value={money(clientPaid)}
                        />
                        <Row
                            label="Parte de la empresa"
                            value={money(net - clientShare)}
                        />
                        <Row
                            label="Efectivo a entregar en oficina"
                            value={money(net - clientPaid)}
                            strong
                        />
                    </dl>
                    {lossAdded > 0 && (
                        <p className="border-t px-4 py-3 text-xs text-red-600 dark:text-red-400">
                            El corte queda en pérdida: la pulpería asume{' '}
                            {money(lossAdded)} que se le rebajará de sus
                            próximas ganancias.
                        </p>
                    )}
                </Panel>
            </div>

            <Button size="lg" disabled={form.processing || cut.length === 0}>
                Guardar corte
            </Button>
            {cut.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    No hay máquinas para cortar en esta visita.
                </p>
            )}
        </form>
    );
}

function Row({
    label,
    value,
    className,
    strong,
}: {
    label: string;
    value: string;
    className?: string;
    strong?: boolean;
}) {
    return (
        <div
            className={`flex items-center justify-between px-4 py-2.5 ${strong ? 'bg-muted/50 font-semibold' : ''}`}
        >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={`tabular-nums ${className ?? ''}`}>{value}</dd>
        </div>
    );
}

CollectionCreate.layout = {
    breadcrumbs: [
        { title: 'Cortes', href: collections.index() },
        { title: 'Registrar', href: collections.create() },
    ],
};

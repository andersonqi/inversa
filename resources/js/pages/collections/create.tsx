import { Head, router, useForm } from '@inertiajs/react';
import { Camera, History, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Pill } from '@/components/app/badges';
import { Field } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { SignaturePad } from '@/components/app/signature-pad';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { date, money, num, percent, signClass } from '@/lib/format';
import collections from '@/routes/collections';
import type { Client, IdName, Machine } from '@/types';

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
    cash_counted: string;
    notes: string;
    photo: File | null;
};

/** Diferencia máxima entre efectivo contado y teórico sin exigir observación. */
const CASH_TOLERANCE = 0.15;

const COUNTER_ERROR = 'El contador no puede ser menor al anterior registrado';

/** Misma regla que el servidor (CollectionService::exceedsCashTolerance). */
function exceedsCashTolerance(theoretical: number, cash: number | null) {
    if (cash === null) {
        return false;
    }

    const difference = Math.round(Math.abs(cash - theoretical) * 100) / 100;
    const base = Math.abs(theoretical);

    if (base === 0) {
        return difference > 0;
    }

    return difference > Math.round(base * CASH_TOLERANCE * 100) / 100;
}

/** Reduce la foto del contador (máx. 1600 px, JPEG) para subirla rápido en ruta. */
async function compressImage(file: File): Promise<File> {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(
            1,
            1600 / Math.max(bitmap.width, bitmap.height),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas
            .getContext('2d')
            ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.75),
        );

        return blob
            ? new File([blob], 'contador.jpg', { type: 'image/jpeg' })
            : file;
    } catch {
        return file;
    }
}

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
                description="Lea los contadores y cuente el efectivo de cada máquina. Las máquinas en pérdida no se cortan: se espera a que recuperen, salvo que haga un corte forzado."
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
        signature: string;
        loan_id: string;
        loan_deduction: string;
        items: Item[];
    }>({
        client_id: client.id,
        collected_on: today,
        notes: '',
        signature: '',
        loan_id: loans[0] ? String(loans[0].id) : '',
        loan_deduction: '',
        items: machines.map((m) => ({
            machine_id: m.id,
            current_in: '',
            current_out: '',
            mode: 'auto',
            cash_counted: '',
            notes: '',
            photo: null,
        })),
    });

    const rows = machines.map((m, i) => {
        const item = form.data.items[i];
        const credit = Number(m.credit_value);
        const cin =
            item.current_in === '' ? m.counter_in : Number(item.current_in);
        const cout =
            item.current_out === '' ? m.counter_out : Number(item.current_out);
        const inBelow = cin < m.counter_in;
        const outBelow = cout < m.counter_out;
        const invalid = inBelow || outBelow;
        const creditsIn = cin - m.counter_in;
        const creditsOut = cout - m.counter_out;
        const amountIn = creditsIn * credit;
        const amountOut = creditsOut * credit;
        // Monedas teóricas (en dinero): entradas − salidas.
        const net = amountIn - amountOut;
        const cash = item.cash_counted === '' ? null : Number(item.cash_counted);
        const difference = cash === null ? null : cash - net;
        const losing = !invalid && net < 0;
        const skipped =
            item.mode === 'skip' || (losing && item.mode !== 'force');
        const needsNotes = !skipped && exceedsCashTolerance(net, cash);
        const notesMissing = needsNotes && item.notes.trim() === '';

        return {
            machine: m,
            item,
            inBelow,
            outBelow,
            invalid,
            creditsIn,
            creditsOut,
            amountIn,
            amountOut,
            net,
            cash,
            difference,
            losing,
            skipped,
            needsNotes,
            notesMissing,
        };
    });

    const cut = rows.filter((r) => !r.skipped);
    const blocked = cut.some((r) => r.invalid || r.notesMissing);
    // Posición de cada máquina en lo que se envía, para ubicar los errores del servidor.
    const sentIndex = new Map(cut.map((r, i) => [r.machine.id, i]));

    const net = cut.reduce((sum, r) => sum + r.net, 0);
    const counted = cut.filter((r) => r.cash !== null);
    const cashTotal = counted.reduce((sum, r) => sum + (r.cash ?? 0), 0);
    const cashTheoretical = counted.reduce((sum, r) => sum + r.net, 0);
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
    const loansBalance = loans.reduce((sum, l) => sum + Number(l.balance), 0);
    const suggested = selectedLoan
        ? Math.max(
              0,
              Math.min(
                  Number(selectedLoan.installment_amount),
                  Number(selectedLoan.balance),
                  Math.round(clientEarned * 100) / 100,
              ),
          )
        : 0;

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

        if (blocked) {
            return;
        }

        form.transform((data) => ({
            ...data,
            items: cut.map((r) => ({
                machine_id: r.machine.id,
                current_in: r.item.current_in,
                current_out: r.item.current_out,
                forced: r.losing && r.item.mode === 'force',
                cash_counted: r.item.cash_counted,
                notes: r.item.notes,
                photo: r.item.photo,
            })),
            signature: data.signature || null,
            loan_id: data.loan_id || null,
            loan_deduction: data.loan_id ? data.loan_deduction || 0 : 0,
        }));
        form.post(collections.store().url, { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                    {client.name}
                </span>
                <span>· Ruta {client.collection_route?.code}</span>
                <span>· Comisión {percent(client.commission_percent)}</span>
                <span>
                    · {machines.length}{' '}
                    {machines.length === 1 ? 'máquina' : 'máquinas'}
                </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {rows.map((row, i) => (
                    <MachineCard
                        key={row.machine.id}
                        row={row}
                        setItem={(key, value) => setItem(i, key, value)}
                        error={(field) => itemError(row.machine.id, field)}
                    />
                ))}
            </div>
            <InputError message={errors.items} />

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
                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                                El cliente tiene préstamos activos con saldo de{' '}
                                <strong>{money(loansBalance)}</strong>. Se
                                sugiere descontar la cuota de la ganancia del
                                tendero.
                            </div>
                        )}

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
                                            inputMode="decimal"
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
                                        {suggested > 0 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    form.setData(
                                                        'loan_deduction',
                                                        suggested.toFixed(2),
                                                    )
                                                }
                                            >
                                                Aplicar cuota sugerida (
                                                {money(suggested)})
                                            </Button>
                                        )}
                                    </Field>
                                )}
                            </div>
                        )}

                        <Field
                            label="Observaciones generales"
                            htmlFor="notes"
                            error={form.errors.notes}
                        >
                            <Textarea
                                id="notes"
                                value={form.data.notes}
                                onChange={(e) =>
                                    form.setData('notes', e.target.value)
                                }
                                placeholder="Novedades del local"
                            />
                        </Field>
                    </div>
                </Panel>

                <Panel title="Liquidación con la pulpería">
                    <dl className="divide-y text-sm">
                        <Row
                            label={`Total teórico (${cut.length} de ${rows.length} máquinas)`}
                            value={money(net)}
                            className={signClass(net)}
                        />
                        {counted.length > 0 && (
                            <>
                                <Row
                                    label="Efectivo contado"
                                    value={money(cashTotal)}
                                />
                                <Row
                                    label="Diferencia contado vs. teórico"
                                    value={money(cashTotal - cashTheoretical)}
                                    className={signClass(
                                        cashTotal - cashTheoretical,
                                    )}
                                />
                            </>
                        )}
                        <Row
                            label={`Total tendero (${percent(pct)})`}
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
                            label="Total empresa"
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

            <Panel title="Firma del tendero">
                <div className="p-4">
                    <SignaturePad
                        onChange={(value) =>
                            form.setData('signature', value ?? '')
                        }
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                        Opcional. La firma se imprime en el recibo.
                    </p>
                    <InputError message={errors.signature} />
                </div>
            </Panel>

            <div className="sticky bottom-0 -mx-4 space-y-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
                {blocked && (
                    <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                        <TriangleAlert className="size-4" />
                        Corrija los contadores o escriba las observaciones
                        obligatorias antes de guardar.
                    </p>
                )}
                {cut.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No hay máquinas para cortar en esta visita.
                    </p>
                )}
                <Button
                    size="lg"
                    className="w-full md:w-auto"
                    disabled={form.processing || cut.length === 0 || blocked}
                >
                    Guardar corte y generar recibo
                </Button>
            </div>
        </form>
    );
}

type MachineRow = {
    machine: Machine;
    item: Item;
    inBelow: boolean;
    outBelow: boolean;
    invalid: boolean;
    creditsIn: number;
    creditsOut: number;
    amountIn: number;
    amountOut: number;
    net: number;
    cash: number | null;
    difference: number | null;
    losing: boolean;
    skipped: boolean;
    needsNotes: boolean;
    notesMissing: boolean;
};

function MachineCard({
    row,
    setItem,
    error,
}: {
    row: MachineRow;
    setItem: <K extends keyof Item>(key: K, value: Item[K]) => void;
    error: (field: string) => string | undefined;
}) {
    const { machine, item } = row;
    const id = `m${machine.id}`;

    return (
        <section
            className={`rounded-xl border bg-card text-card-foreground ${row.skipped ? 'opacity-70' : ''} ${row.invalid || row.notesMissing ? 'border-red-400 dark:border-red-500/60' : ''}`}
        >
            <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
                <div>
                    <p className="font-mono text-sm font-semibold">
                        {machine.code}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {[machine.brand, machine.model]
                            .filter(Boolean)
                            .join(' ') || 'Máquina'}{' '}
                        · Crédito {money(machine.credit_value)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {row.losing && <Pill tone="red">En pérdida</Pill>}
                    {row.skipped && <Pill tone="gray">No se corta</Pill>}
                    {row.needsNotes && (
                        <Pill tone="amber">Diferencia mayor a 15 %</Pill>
                    )}
                    <MachineHistory machine={machine} />
                </div>
            </header>

            <div className="grid gap-4 p-4">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Entrada anterior" htmlFor={`${id}-pin`}>
                        <Input
                            id={`${id}-pin`}
                            value={num(machine.counter_in)}
                            readOnly
                            tabIndex={-1}
                            className="bg-muted tabular-nums"
                        />
                    </Field>
                    <Field label="Nuevo contador entrada" htmlFor={`${id}-in`}>
                        <Input
                            id={`${id}-in`}
                            type="number"
                            min={machine.counter_in}
                            required={item.mode !== 'skip'}
                            inputMode="numeric"
                            className="tabular-nums"
                            value={item.current_in}
                            onChange={(e) =>
                                setItem('current_in', e.target.value)
                            }
                            aria-invalid={
                                row.inBelow || !!error('current_in')
                            }
                        />
                    </Field>
                    <Field label="Salida anterior" htmlFor={`${id}-pout`}>
                        <Input
                            id={`${id}-pout`}
                            value={num(machine.counter_out)}
                            readOnly
                            tabIndex={-1}
                            className="bg-muted tabular-nums"
                        />
                    </Field>
                    <Field label="Nuevo contador salida" htmlFor={`${id}-out`}>
                        <Input
                            id={`${id}-out`}
                            type="number"
                            min={machine.counter_out}
                            required={item.mode !== 'skip'}
                            inputMode="numeric"
                            className="tabular-nums"
                            value={item.current_out}
                            onChange={(e) =>
                                setItem('current_out', e.target.value)
                            }
                            aria-invalid={
                                row.outBelow || !!error('current_out')
                            }
                        />
                    </Field>
                </div>
                {(row.inBelow || row.outBelow) && (
                    <p className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        <TriangleAlert className="size-4 shrink-0" />
                        {COUNTER_ERROR} (
                        {row.inBelow
                            ? `entrada ${num(machine.counter_in)}`
                            : `salida ${num(machine.counter_out)}`}
                        ).
                    </p>
                )}
                <InputError message={error('current_in')} />
                <InputError message={error('current_out')} />
                <InputError message={error('machine_id')} />

                <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center text-xs">
                    <div>
                        <dt className="text-muted-foreground">Entradas</dt>
                        <dd className="text-sm font-medium tabular-nums">
                            {num(row.creditsIn)}
                        </dd>
                        <dd className="text-muted-foreground tabular-nums">
                            {money(row.amountIn)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Salidas</dt>
                        <dd className="text-sm font-medium tabular-nums">
                            {num(row.creditsOut)}
                        </dd>
                        <dd className="text-muted-foreground tabular-nums">
                            {money(row.amountOut)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Teórico</dt>
                        <dd
                            className={`text-sm font-semibold tabular-nums ${signClass(row.net)}`}
                        >
                            {money(row.net)}
                        </dd>
                    </div>
                </dl>

                <div className="grid grid-cols-2 gap-3">
                    <Field
                        label="Efectivo contado (reales)"
                        htmlFor={`${id}-cash`}
                        error={error('cash_counted')}
                    >
                        <Input
                            id={`${id}-cash`}
                            type="number"
                            step="0.01"
                            min={0}
                            inputMode="decimal"
                            className="tabular-nums"
                            value={item.cash_counted}
                            onChange={(e) =>
                                setItem('cash_counted', e.target.value)
                            }
                        />
                    </Field>
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">
                            Faltante / sobrante
                        </span>
                        <p
                            className={`flex h-9 items-center text-base font-semibold tabular-nums ${row.difference === null ? 'text-muted-foreground' : signClass(row.difference)}`}
                        >
                            {row.difference === null
                                ? '—'
                                : money(row.difference)}
                        </p>
                    </div>
                </div>

                <Field
                    label={
                        row.needsNotes
                            ? 'Observaciones (obligatorio)'
                            : 'Observaciones'
                    }
                    htmlFor={`${id}-notes`}
                    error={
                        error('notes') ??
                        (row.notesMissing
                            ? 'La diferencia supera el 15 %: explique el motivo.'
                            : undefined)
                    }
                >
                    <Textarea
                        id={`${id}-notes`}
                        rows={2}
                        required={row.needsNotes}
                        value={item.notes}
                        onChange={(e) => setItem('notes', e.target.value)}
                        placeholder="Novedades de esta máquina"
                    />
                </Field>

                <div className="flex flex-wrap items-end gap-3">
                    <PhotoInput
                        label={`Foto del contador de ${machine.code}`}
                        file={item.photo}
                        onChange={(file) => setItem('photo', file)}
                    />
                    <div className="grid flex-1 gap-1">
                        {row.losing ? (
                            <NativeSelect
                                aria-label={`Corte de ${machine.code}`}
                                value={item.mode === 'force' ? 'force' : 'auto'}
                                onChange={(e) =>
                                    setItem('mode', e.target.value as Mode)
                                }
                            >
                                <option value="auto">
                                    Esperar a que recupere
                                </option>
                                <option value="force">Corte forzado</option>
                            </NativeSelect>
                        ) : (
                            <NativeSelect
                                aria-label={`Corte de ${machine.code}`}
                                value={item.mode === 'skip' ? 'skip' : 'auto'}
                                onChange={(e) =>
                                    setItem('mode', e.target.value as Mode)
                                }
                            >
                                <option value="auto">Cortar</option>
                                <option value="skip">No cortar</option>
                            </NativeSelect>
                        )}
                    </div>
                </div>
                <InputError message={error('forced')} />
                <InputError message={error('photo')} />
            </div>
        </section>
    );
}

function PhotoInput({
    label,
    file,
    onChange,
}: {
    label: string;
    file: File | null;
    onChange: (file: File | null) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const pick = async (selected: File | undefined) => {
        if (!selected) {
            return;
        }

        setBusy(true);
        const compressed = await compressImage(selected);
        onChange(compressed);

        const reader = new FileReader();
        reader.onload = () =>
            setPreview(
                typeof reader.result === 'string' ? reader.result : null,
            );
        reader.readAsDataURL(compressed);
        setBusy(false);
    };

    const remove = () => {
        onChange(null);
        setPreview(null);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <div className="flex items-center gap-2">
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                aria-label={label}
                onChange={(e) => void pick(e.target.files?.[0])}
            />
            {file && preview ? (
                <>
                    <img
                        src={preview}
                        alt={label}
                        className="size-9 rounded-md border object-cover"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={remove}
                    >
                        Quitar foto
                    </Button>
                </>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                >
                    <Camera /> {busy ? 'Procesando…' : 'Tomar foto'}
                </Button>
            )}
        </div>
    );
}

function MachineHistory({ machine }: { machine: Machine }) {
    const readings = machine.recent_readings ?? [];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <History /> Histórico
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogTitle>Histórico de {machine.code}</DialogTitle>
                <DialogDescription>
                    Últimas {readings.length || ''} lecturas registradas.
                </DialogDescription>
                {readings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        La máquina aún no tiene cortes.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">
                                        Entrada
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Salida
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Teórico
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Real
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Faltante
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {readings.map((r) => {
                                    const diff =
                                        r.cash_counted === null
                                            ? null
                                            : Number(r.cash_counted) -
                                              Number(r.net);

                                    return (
                                        <TableRow key={r.id}>
                                            <TableCell>
                                                {date(
                                                    r.collection?.collected_on,
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-xs tabular-nums">
                                                {num(r.previous_in)} →{' '}
                                                {num(r.current_in)}
                                            </TableCell>
                                            <TableCell className="text-right text-xs tabular-nums">
                                                {num(r.previous_out)} →{' '}
                                                {num(r.current_out)}
                                            </TableCell>
                                            <TableCell
                                                className={`text-right tabular-nums ${signClass(r.net)}`}
                                            >
                                                {money(r.net)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {r.cash_counted === null
                                                    ? '—'
                                                    : money(r.cash_counted)}
                                            </TableCell>
                                            <TableCell
                                                className={`text-right tabular-nums ${diff === null ? '' : signClass(diff)}`}
                                            >
                                                {diff === null
                                                    ? '—'
                                                    : money(diff)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
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

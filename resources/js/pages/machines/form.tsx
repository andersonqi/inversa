import { Form, Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { Field, FormGrid } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import machines from '@/routes/machines';
import type { IdName, Machine, Option } from '@/types';

export default function MachineForm({
    machine,
    hasReadings,
    offices,
    statuses,
    clients,
}: {
    machine: Machine | null;
    hasReadings: boolean;
    offices: IdName[];
    statuses: Option[];
    clients: (IdName & { office_id: number })[];
}) {
    const title = machine ? `Editar máquina ${machine.code}` : 'Nueva máquina';
    const [officeId, setOfficeId] = useState(
        String(machine?.office_id ?? offices[0]?.id ?? ''),
    );
    const [status, setStatus] = useState<string>(
        machine?.status ?? 'warehouse',
    );

    return (
        <Page className="max-w-3xl">
            <Head title={title} />
            <PageHeader title={title} />
            <Panel>
                <Form
                    {...(machine
                        ? machines.update.form(machine.id)
                        : machines.store.form())}
                    className="space-y-8 p-4 md:p-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <FormGrid>
                                <Field
                                    label="Código"
                                    htmlFor="code"
                                    error={errors.code}
                                >
                                    <Input
                                        id="code"
                                        name="code"
                                        defaultValue={machine?.code}
                                        required
                                        placeholder="MAQ-0001"
                                    />
                                </Field>
                                <Field
                                    label="Número de serie"
                                    htmlFor="serial"
                                    error={errors.serial}
                                >
                                    <Input
                                        id="serial"
                                        name="serial"
                                        defaultValue={machine?.serial ?? ''}
                                    />
                                </Field>
                                <Field
                                    label="Marca"
                                    htmlFor="brand"
                                    error={errors.brand}
                                >
                                    <Input
                                        id="brand"
                                        name="brand"
                                        defaultValue={machine?.brand ?? ''}
                                    />
                                </Field>
                                <Field
                                    label="Modelo"
                                    htmlFor="model"
                                    error={errors.model}
                                >
                                    <Input
                                        id="model"
                                        name="model"
                                        defaultValue={machine?.model ?? ''}
                                    />
                                </Field>
                                <Field
                                    label="Costo de compra"
                                    htmlFor="purchase_cost"
                                    error={errors.purchase_cost}
                                >
                                    <Input
                                        id="purchase_cost"
                                        name="purchase_cost"
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        defaultValue={
                                            machine?.purchase_cost ?? ''
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Oficina"
                                    htmlFor="office_id"
                                    error={errors.office_id}
                                >
                                    <NativeSelect
                                        id="office_id"
                                        name="office_id"
                                        value={officeId}
                                        onChange={(e) =>
                                            setOfficeId(e.target.value)
                                        }
                                    >
                                        {offices.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                            </FormGrid>

                            <fieldset className="space-y-4">
                                <legend className="text-sm font-semibold">
                                    Ubicación
                                </legend>
                                <FormGrid>
                                    <Field
                                        label="Estado"
                                        htmlFor="status"
                                        error={errors.status}
                                    >
                                        <NativeSelect
                                            id="status"
                                            name="status"
                                            value={status}
                                            onChange={(e) =>
                                                setStatus(e.target.value)
                                            }
                                        >
                                            {statuses.map((s) => (
                                                <option
                                                    key={s.value}
                                                    value={s.value}
                                                >
                                                    {s.label}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </Field>
                                    {status === 'installed' && (
                                        <>
                                            <Field
                                                label="Cliente"
                                                htmlFor="client_id"
                                                error={errors.client_id}
                                            >
                                                <NativeSelect
                                                    key={officeId}
                                                    id="client_id"
                                                    name="client_id"
                                                    defaultValue={
                                                        machine?.client_id ?? ''
                                                    }
                                                    required
                                                >
                                                    <option value="" disabled>
                                                        Seleccione…
                                                    </option>
                                                    {clients
                                                        .filter(
                                                            (c) =>
                                                                String(
                                                                    c.office_id,
                                                                ) === officeId,
                                                        )
                                                        .map((c) => (
                                                            <option
                                                                key={c.id}
                                                                value={c.id}
                                                            >
                                                                {c.name}
                                                            </option>
                                                        ))}
                                                </NativeSelect>
                                            </Field>
                                            <Field
                                                label="Fecha de instalación"
                                                htmlFor="installed_at"
                                                error={errors.installed_at}
                                            >
                                                <Input
                                                    id="installed_at"
                                                    name="installed_at"
                                                    type="date"
                                                    defaultValue={
                                                        machine?.installed_at?.slice(
                                                            0,
                                                            10,
                                                        ) ?? ''
                                                    }
                                                />
                                            </Field>
                                        </>
                                    )}
                                </FormGrid>
                            </fieldset>

                            <fieldset className="space-y-4">
                                <legend className="text-sm font-semibold">
                                    Contadores
                                </legend>
                                {hasReadings ? (
                                    <p className="text-sm text-muted-foreground">
                                        La máquina ya tiene cortes: los
                                        contadores y el valor del crédito solo
                                        cambian al registrar cortes.
                                    </p>
                                ) : (
                                    <FormGrid>
                                        <Field
                                            label="Valor del crédito"
                                            htmlFor="credit_value"
                                            error={errors.credit_value}
                                            hint="Dinero que representa cada crédito de los contadores."
                                        >
                                            <Input
                                                id="credit_value"
                                                name="credit_value"
                                                type="number"
                                                step="0.01"
                                                min={0.01}
                                                defaultValue={
                                                    machine?.credit_value ?? 1
                                                }
                                                required
                                            />
                                        </Field>
                                        <div />
                                        <Field
                                            label="Contador de entrada inicial"
                                            htmlFor="counter_in"
                                            error={errors.counter_in}
                                        >
                                            <Input
                                                id="counter_in"
                                                name="counter_in"
                                                type="number"
                                                min={0}
                                                defaultValue={
                                                    machine?.counter_in ?? 0
                                                }
                                            />
                                        </Field>
                                        <Field
                                            label="Contador de salida inicial"
                                            htmlFor="counter_out"
                                            error={errors.counter_out}
                                        >
                                            <Input
                                                id="counter_out"
                                                name="counter_out"
                                                type="number"
                                                min={0}
                                                defaultValue={
                                                    machine?.counter_out ?? 0
                                                }
                                            />
                                        </Field>
                                    </FormGrid>
                                )}
                                {hasReadings && (
                                    <input
                                        type="hidden"
                                        name="credit_value"
                                        value={machine?.credit_value}
                                    />
                                )}
                            </fieldset>

                            <Field
                                label="Notas"
                                htmlFor="notes"
                                error={errors.notes}
                            >
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    defaultValue={machine?.notes ?? ''}
                                />
                            </Field>

                            <div className="flex gap-2">
                                <Button disabled={processing}>Guardar</Button>
                                <Button variant="ghost" asChild>
                                    <Link
                                        href={
                                            machine
                                                ? machines.show(machine.id)
                                                : machines.index()
                                        }
                                    >
                                        Cancelar
                                    </Link>
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </Panel>
        </Page>
    );
}

MachineForm.layout = {
    breadcrumbs: [
        { title: 'Máquinas', href: machines.index() },
        { title: 'Formulario', href: '#' },
    ],
};

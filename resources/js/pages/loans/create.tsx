import { Form, Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { Field, FormGrid } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { money } from '@/lib/format';
import loans from '@/routes/loans';
import type { IdName, Option } from '@/types';

export default function LoanCreate({
    clients,
    frequencies,
    clientId,
    today,
}: {
    clients: IdName[];
    frequencies: Option[];
    clientId: number | null;
    today: string;
}) {
    const [principal, setPrincipal] = useState('');
    const [interest, setInterest] = useState('20');
    const [installments, setInstallments] = useState('8');

    const total = Number(principal || 0) * (1 + Number(interest || 0) / 100);
    const installment =
        Number(installments) > 0 ? total / Number(installments) : 0;

    return (
        <Page className="max-w-3xl">
            <Head title="Nuevo préstamo" />
            <PageHeader
                title="Nuevo préstamo"
                description="El interés es plano sobre el capital y se reparte en cuotas iguales."
            />
            <Panel>
                <Form {...loans.store.form()} className="space-y-6 p-4 md:p-6">
                    {({ processing, errors }) => (
                        <>
                            <FormGrid>
                                <Field
                                    label="Cliente"
                                    htmlFor="client_id"
                                    error={errors.client_id}
                                    className="sm:col-span-2"
                                >
                                    <NativeSelect
                                        id="client_id"
                                        name="client_id"
                                        defaultValue={clientId ?? ''}
                                        required
                                    >
                                        <option value="" disabled>
                                            Seleccione…
                                        </option>
                                        {clients.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field
                                    label="Capital prestado"
                                    htmlFor="principal"
                                    error={errors.principal}
                                >
                                    <Input
                                        id="principal"
                                        name="principal"
                                        type="number"
                                        step="0.01"
                                        min={0.01}
                                        value={principal}
                                        onChange={(e) =>
                                            setPrincipal(e.target.value)
                                        }
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Interés total (%)"
                                    htmlFor="interest_percent"
                                    error={errors.interest_percent}
                                >
                                    <Input
                                        id="interest_percent"
                                        name="interest_percent"
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={interest}
                                        onChange={(e) =>
                                            setInterest(e.target.value)
                                        }
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Frecuencia de pago"
                                    htmlFor="frequency"
                                    error={errors.frequency}
                                >
                                    <NativeSelect
                                        id="frequency"
                                        name="frequency"
                                        defaultValue="weekly"
                                    >
                                        {frequencies.map((f) => (
                                            <option
                                                key={f.value}
                                                value={f.value}
                                            >
                                                {f.label}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field
                                    label="Número de cuotas"
                                    htmlFor="installments"
                                    error={errors.installments}
                                >
                                    <Input
                                        id="installments"
                                        name="installments"
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={installments}
                                        onChange={(e) =>
                                            setInstallments(e.target.value)
                                        }
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Fecha de desembolso"
                                    htmlFor="issued_on"
                                    error={errors.issued_on}
                                >
                                    <Input
                                        id="issued_on"
                                        name="issued_on"
                                        type="date"
                                        defaultValue={today}
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Primera cuota"
                                    htmlFor="first_due_on"
                                    error={errors.first_due_on}
                                >
                                    <Input
                                        id="first_due_on"
                                        name="first_due_on"
                                        type="date"
                                        defaultValue={today}
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Notas"
                                    htmlFor="notes"
                                    error={errors.notes}
                                    className="sm:col-span-2"
                                >
                                    <Textarea id="notes" name="notes" />
                                </Field>
                            </FormGrid>

                            <div className="grid gap-px overflow-hidden rounded-lg border bg-border text-sm sm:grid-cols-2">
                                <div className="bg-muted/40 px-4 py-3">
                                    <p className="text-xs text-muted-foreground">
                                        Total a pagar
                                    </p>
                                    <p className="text-lg font-semibold tabular-nums">
                                        {money(total)}
                                    </p>
                                </div>
                                <div className="bg-muted/40 px-4 py-3">
                                    <p className="text-xs text-muted-foreground">
                                        Valor de cada cuota
                                    </p>
                                    <p className="text-lg font-semibold tabular-nums">
                                        {money(installment)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button disabled={processing}>
                                    Otorgar préstamo
                                </Button>
                                <Button variant="ghost" asChild>
                                    <Link href={loans.index()}>Cancelar</Link>
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </Panel>
        </Page>
    );
}

LoanCreate.layout = {
    breadcrumbs: [
        { title: 'Préstamos', href: loans.index() },
        { title: 'Nuevo', href: loans.create() },
    ],
};

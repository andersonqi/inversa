import { Form, Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { Field, FormGrid } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import expenses from '@/routes/expenses';
import type { Expense, IdName, Option } from '@/types';

export default function ExpenseForm({
    expense,
    offices,
    routes,
    machines,
    categories,
    today,
}: {
    expense: Expense | null;
    offices: IdName[];
    routes: (IdName & { office_id: number })[];
    machines: { id: number; code: string; office_id: number }[];
    categories: Option[];
    today: string;
}) {
    const title = expense ? 'Editar gasto' : 'Registrar gasto';
    const [officeId, setOfficeId] = useState(
        String(expense?.office_id ?? offices[0]?.id ?? ''),
    );

    return (
        <Page className="max-w-3xl">
            <Head title={title} />
            <PageHeader title={title} />
            <Panel>
                <Form
                    {...(expense
                        ? expenses.update.form(expense.id)
                        : expenses.store.form())}
                    className="space-y-6 p-4 md:p-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <FormGrid>
                                <Field
                                    label="Fecha"
                                    htmlFor="spent_on"
                                    error={errors.spent_on}
                                >
                                    <Input
                                        id="spent_on"
                                        name="spent_on"
                                        type="date"
                                        max={today}
                                        defaultValue={
                                            expense?.spent_on?.slice(0, 10) ??
                                            today
                                        }
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Monto"
                                    htmlFor="amount"
                                    error={errors.amount}
                                >
                                    <Input
                                        id="amount"
                                        name="amount"
                                        type="number"
                                        step="0.01"
                                        min={0.01}
                                        defaultValue={expense?.amount}
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Categoría"
                                    htmlFor="category"
                                    error={errors.category}
                                >
                                    <NativeSelect
                                        id="category"
                                        name="category"
                                        defaultValue={
                                            expense?.category ?? 'fuel'
                                        }
                                    >
                                        {categories.map((c) => (
                                            <option
                                                key={c.value}
                                                value={c.value}
                                            >
                                                {c.label}
                                            </option>
                                        ))}
                                    </NativeSelect>
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
                                <Field
                                    label="Ruta (opcional)"
                                    htmlFor="collection_route_id"
                                    error={errors.collection_route_id}
                                >
                                    <NativeSelect
                                        key={`r${officeId}`}
                                        id="collection_route_id"
                                        name="collection_route_id"
                                        defaultValue={
                                            expense?.collection_route_id ?? ''
                                        }
                                    >
                                        <option value="">
                                            Gasto general de la oficina
                                        </option>
                                        {routes
                                            .filter(
                                                (r) =>
                                                    String(r.office_id) ===
                                                    officeId,
                                            )
                                            .map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name}
                                                </option>
                                            ))}
                                    </NativeSelect>
                                </Field>
                                <Field
                                    label="Máquina (opcional)"
                                    htmlFor="machine_id"
                                    error={errors.machine_id}
                                >
                                    <NativeSelect
                                        key={`m${officeId}`}
                                        id="machine_id"
                                        name="machine_id"
                                        defaultValue={expense?.machine_id ?? ''}
                                    >
                                        <option value="">—</option>
                                        {machines
                                            .filter(
                                                (m) =>
                                                    String(m.office_id) ===
                                                    officeId,
                                            )
                                            .map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.code}
                                                </option>
                                            ))}
                                    </NativeSelect>
                                </Field>
                                <Field
                                    label="Descripción"
                                    htmlFor="description"
                                    error={errors.description}
                                    className="sm:col-span-2"
                                >
                                    <Input
                                        id="description"
                                        name="description"
                                        defaultValue={
                                            expense?.description ?? ''
                                        }
                                    />
                                </Field>
                            </FormGrid>
                            <div className="flex gap-2">
                                <Button disabled={processing}>Guardar</Button>
                                <Button variant="ghost" asChild>
                                    <Link href={expenses.index()}>
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

ExpenseForm.layout = {
    breadcrumbs: [
        { title: 'Gastos', href: expenses.index() },
        { title: 'Formulario', href: '#' },
    ],
};

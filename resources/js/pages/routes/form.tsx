import { Form, Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { CheckboxField } from '@/components/app/checkbox-field';
import { Field, FormGrid } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import routes from '@/routes/routes';
import type { CollectionRoute, IdName } from '@/types';

export default function RouteForm({
    route,
    offices,
    collectors,
}: {
    route: CollectionRoute | null;
    offices: IdName[];
    collectors: (IdName & { office_id: number | null })[];
}) {
    const title = route ? `Editar ruta ${route.code}` : 'Nueva ruta';
    const [officeId, setOfficeId] = useState(
        String(route?.office_id ?? offices[0]?.id ?? ''),
    );

    return (
        <Page className="max-w-3xl">
            <Head title={title} />
            <PageHeader title={title} />
            <Panel>
                <Form
                    {...(route
                        ? routes.update.form(route.id)
                        : routes.store.form())}
                    className="space-y-6 p-4 md:p-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <FormGrid>
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
                                    label="Cobrador"
                                    htmlFor="collector_id"
                                    error={errors.collector_id}
                                >
                                    <NativeSelect
                                        key={officeId}
                                        id="collector_id"
                                        name="collector_id"
                                        defaultValue={route?.collector_id ?? ''}
                                    >
                                        <option value="">Sin asignar</option>
                                        {collectors
                                            .filter(
                                                (c) =>
                                                    String(c.office_id) ===
                                                    officeId,
                                            )
                                            .map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                    </NativeSelect>
                                </Field>
                                <Field
                                    label="Código"
                                    htmlFor="code"
                                    error={errors.code}
                                >
                                    <Input
                                        id="code"
                                        name="code"
                                        defaultValue={route?.code}
                                        required
                                        maxLength={20}
                                        placeholder="R01"
                                    />
                                </Field>
                                <Field
                                    label="Nombre"
                                    htmlFor="name"
                                    error={errors.name}
                                >
                                    <Input
                                        id="name"
                                        name="name"
                                        defaultValue={route?.name}
                                        required
                                    />
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
                                        defaultValue={route?.description ?? ''}
                                        placeholder="Sectores o barrios que recorre"
                                    />
                                </Field>
                            </FormGrid>
                            <CheckboxField
                                name="is_active"
                                label="Ruta activa"
                                defaultChecked={route?.is_active ?? true}
                            />
                            <div className="flex gap-2">
                                <Button disabled={processing}>Guardar</Button>
                                <Button variant="ghost" asChild>
                                    <Link href={routes.index()}>Cancelar</Link>
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </Panel>
        </Page>
    );
}

RouteForm.layout = {
    breadcrumbs: [
        { title: 'Rutas', href: routes.index() },
        { title: 'Formulario', href: '#' },
    ],
};

import { Form, Head, Link } from '@inertiajs/react';
import { CheckboxField } from '@/components/app/checkbox-field';
import { Field, FormGrid } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { WEEK_DAYS } from '@/lib/route-tools';
import clients from '@/routes/clients';
import type { Client, IdName } from '@/types';

export default function ClientForm({
    client,
    routes,
}: {
    client: Client | null;
    routes: IdName[];
}) {
    const title = client ? `Editar ${client.name}` : 'Nuevo cliente';

    return (
        <Page className="max-w-3xl">
            <Head title={title} />
            <PageHeader title={title} />
            <Panel>
                <Form
                    {...(client
                        ? clients.update.form(client.id)
                        : clients.store.form())}
                    className="space-y-6 p-4 md:p-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <FormGrid>
                                <Field
                                    label="Nombre del cliente"
                                    htmlFor="name"
                                    error={errors.name}
                                >
                                    <Input
                                        id="name"
                                        name="name"
                                        defaultValue={client?.name}
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Nombre del negocio"
                                    htmlFor="business_name"
                                    error={errors.business_name}
                                >
                                    <Input
                                        id="business_name"
                                        name="business_name"
                                        defaultValue={
                                            client?.business_name ?? ''
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Documento"
                                    htmlFor="document"
                                    error={errors.document}
                                >
                                    <Input
                                        id="document"
                                        name="document"
                                        defaultValue={client?.document ?? ''}
                                    />
                                </Field>
                                <Field
                                    label="Teléfono"
                                    htmlFor="phone"
                                    error={errors.phone}
                                >
                                    <Input
                                        id="phone"
                                        name="phone"
                                        defaultValue={client?.phone ?? ''}
                                    />
                                </Field>
                                <Field
                                    label="Dirección"
                                    htmlFor="address"
                                    error={errors.address}
                                    className="sm:col-span-2"
                                >
                                    <Input
                                        id="address"
                                        name="address"
                                        defaultValue={client?.address ?? ''}
                                    />
                                </Field>
                                <Field
                                    label="Ruta"
                                    htmlFor="collection_route_id"
                                    error={errors.collection_route_id}
                                >
                                    <NativeSelect
                                        id="collection_route_id"
                                        name="collection_route_id"
                                        defaultValue={
                                            client?.collection_route_id ?? ''
                                        }
                                        required
                                    >
                                        <option value="" disabled>
                                            Seleccione…
                                        </option>
                                        {routes.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field
                                    label="Orden de visita"
                                    htmlFor="visit_order"
                                    error={errors.visit_order}
                                    hint="Posición del cliente en el recorrido."
                                >
                                    <Input
                                        id="visit_order"
                                        name="visit_order"
                                        type="number"
                                        min={0}
                                        defaultValue={client?.visit_order ?? 0}
                                    />
                                </Field>
                                <Field
                                    label="Día de visita"
                                    htmlFor="visit_day"
                                    error={errors.visit_day}
                                    hint="Día de la semana en que toca el corte."
                                >
                                    <NativeSelect
                                        id="visit_day"
                                        name="visit_day"
                                        defaultValue={client?.visit_day ?? ''}
                                    >
                                        <option value="">Sin día fijo</option>
                                        {WEEK_DAYS.map((d) => (
                                            <option
                                                key={d.value}
                                                value={d.value}
                                            >
                                                {d.label}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field
                                    label="Latitud"
                                    htmlFor="latitude"
                                    error={errors.latitude}
                                    hint="Opcional. También se puede tomar en campo desde la tarjeta del cliente."
                                >
                                    <Input
                                        id="latitude"
                                        name="latitude"
                                        type="number"
                                        step="0.0000001"
                                        min={-90}
                                        max={90}
                                        defaultValue={client?.latitude ?? ''}
                                    />
                                </Field>
                                <Field
                                    label="Longitud"
                                    htmlFor="longitude"
                                    error={errors.longitude}
                                >
                                    <Input
                                        id="longitude"
                                        name="longitude"
                                        type="number"
                                        step="0.0000001"
                                        min={-180}
                                        max={180}
                                        defaultValue={client?.longitude ?? ''}
                                    />
                                </Field>
                                <Field
                                    label="Comisión del cliente (%)"
                                    htmlFor="commission_percent"
                                    error={errors.commission_percent}
                                    hint="Porcentaje de la ganancia neta de cada corte que se entrega al cliente."
                                >
                                    <Input
                                        id="commission_percent"
                                        name="commission_percent"
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        max={100}
                                        defaultValue={
                                            client?.commission_percent ?? 30
                                        }
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Notas"
                                    htmlFor="notes"
                                    error={errors.notes}
                                    className="sm:col-span-2"
                                >
                                    <Textarea
                                        id="notes"
                                        name="notes"
                                        defaultValue={client?.notes ?? ''}
                                    />
                                </Field>
                            </FormGrid>
                            <CheckboxField
                                name="is_active"
                                label="Cliente activo"
                                defaultChecked={client?.is_active ?? true}
                            />
                            <div className="flex gap-2">
                                <Button disabled={processing}>Guardar</Button>
                                <Button variant="ghost" asChild>
                                    <Link
                                        href={
                                            client
                                                ? clients.show(client.id)
                                                : clients.index()
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

ClientForm.layout = {
    breadcrumbs: [
        { title: 'Clientes', href: clients.index() },
        { title: 'Formulario', href: '#' },
    ],
};

import { Form, Head, Link } from '@inertiajs/react';
import { CheckboxField } from '@/components/app/checkbox-field';
import { Field, FormGrid } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import offices from '@/routes/offices';
import type { Office } from '@/types';

export default function OfficeForm({ office }: { office: Office | null }) {
    const title = office ? `Editar ${office.name}` : 'Nueva oficina';

    return (
        <Page className="max-w-3xl">
            <Head title={title} />
            <PageHeader title={title} />

            <Panel>
                <Form
                    {...(office
                        ? offices.update.form(office.id)
                        : offices.store.form())}
                    className="space-y-6 p-4 md:p-6"
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
                                        defaultValue={office?.code}
                                        required
                                        maxLength={20}
                                        placeholder="CEN"
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
                                        defaultValue={office?.name}
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Ciudad"
                                    htmlFor="city"
                                    error={errors.city}
                                >
                                    <Input
                                        id="city"
                                        name="city"
                                        defaultValue={office?.city ?? ''}
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
                                        defaultValue={office?.phone ?? ''}
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
                                        defaultValue={office?.address ?? ''}
                                    />
                                </Field>
                            </FormGrid>
                            <CheckboxField
                                name="is_active"
                                label="Oficina activa"
                                defaultChecked={office?.is_active ?? true}
                            />
                            <div className="flex gap-2">
                                <Button disabled={processing}>Guardar</Button>
                                <Button variant="ghost" asChild>
                                    <Link href={offices.index()}>Cancelar</Link>
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </Panel>
        </Page>
    );
}

OfficeForm.layout = {
    breadcrumbs: [
        { title: 'Oficinas', href: offices.index() },
        { title: 'Formulario', href: '#' },
    ],
};

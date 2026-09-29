import { Form, Head, Link } from '@inertiajs/react';
import { Field, FormGrid } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import roles from '@/routes/roles';
import type { Option, Role } from '@/types';

type Module = {
    module: string;
    permissions: { key: string; label: string }[];
};

export default function RoleForm({
    role,
    modules,
    scopes,
}: {
    role: Role | null;
    modules: Module[];
    scopes: Option[];
}) {
    const title = role ? `Editar rol ${role.name}` : 'Nuevo rol';

    return (
        <Page className="max-w-4xl">
            <Head title={title} />
            <PageHeader title={title} />

            <Form
                {...(role ? roles.update.form(role.id) : roles.store.form())}
                className="space-y-6"
            >
                {({ processing, errors }) => (
                    <>
                        <Panel className="p-4 md:p-6">
                            <FormGrid>
                                <Field
                                    label="Nombre"
                                    htmlFor="name"
                                    error={errors.name}
                                >
                                    <Input
                                        id="name"
                                        name="name"
                                        defaultValue={role?.name}
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Alcance de datos"
                                    htmlFor="scope"
                                    error={errors.scope}
                                    hint="Define qué registros ve el usuario en todos los módulos."
                                >
                                    <NativeSelect
                                        id="scope"
                                        name="scope"
                                        defaultValue={role?.scope ?? 'office'}
                                    >
                                        {scopes.map((s) => (
                                            <option
                                                key={s.value}
                                                value={s.value}
                                            >
                                                {s.label}
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
                                        defaultValue={role?.description ?? ''}
                                    />
                                </Field>
                            </FormGrid>
                        </Panel>

                        <Panel title="Permisos">
                            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
                                {modules.map((m) => (
                                    <fieldset
                                        key={m.module}
                                        className="space-y-2 bg-card p-4"
                                    >
                                        <legend className="sr-only">
                                            {m.module}
                                        </legend>
                                        <p className="text-sm font-semibold">
                                            {m.module}
                                        </p>
                                        {m.permissions.map((p) => (
                                            <label
                                                key={p.key}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="permissions[]"
                                                    value={p.key}
                                                    defaultChecked={role?.permissions.includes(
                                                        p.key,
                                                    )}
                                                    className="size-4 rounded border-input accent-primary"
                                                />
                                                {p.label}
                                            </label>
                                        ))}
                                    </fieldset>
                                ))}
                            </div>
                            <InputError
                                className="px-4 pb-4"
                                message={errors.permissions}
                            />
                        </Panel>

                        <div className="flex gap-2">
                            <Button disabled={processing}>Guardar</Button>
                            <Button variant="ghost" asChild>
                                <Link href={roles.index()}>Cancelar</Link>
                            </Button>
                        </div>
                    </>
                )}
            </Form>
        </Page>
    );
}

RoleForm.layout = {
    breadcrumbs: [
        { title: 'Roles', href: roles.index() },
        { title: 'Formulario', href: '#' },
    ],
};

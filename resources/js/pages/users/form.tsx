import { Form, Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { CheckboxField } from '@/components/app/checkbox-field';
import { Field, FormGrid } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import users from '@/routes/users';
import type { AppUser, IdName, Role } from '@/types';

export default function UserForm({
    user,
    offices,
    roles,
}: {
    user: AppUser | null;
    offices: IdName[];
    roles: Pick<Role, 'id' | 'name' | 'scope'>[];
}) {
    const title = user ? `Editar ${user.name}` : 'Nuevo usuario';
    const [roleId, setRoleId] = useState(
        String(user?.role_id ?? roles[0]?.id ?? ''),
    );
    const selectedRole = roles.find((r) => String(r.id) === roleId);

    return (
        <Page className="max-w-3xl">
            <Head title={title} />
            <PageHeader title={title} />
            <Panel>
                <Form
                    {...(user
                        ? users.update.form(user.id)
                        : users.store.form())}
                    className="space-y-6 p-4 md:p-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <FormGrid>
                                <Field
                                    label="Nombre"
                                    htmlFor="name"
                                    error={errors.name}
                                >
                                    <Input
                                        id="name"
                                        name="name"
                                        defaultValue={user?.name}
                                        required
                                    />
                                </Field>
                                <Field
                                    label="Correo electrónico"
                                    htmlFor="email"
                                    error={errors.email}
                                >
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        defaultValue={user?.email}
                                        required
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
                                        defaultValue={user?.phone ?? ''}
                                    />
                                </Field>
                                <Field
                                    label="Rol"
                                    htmlFor="role_id"
                                    error={errors.role_id}
                                >
                                    <NativeSelect
                                        id="role_id"
                                        name="role_id"
                                        value={roleId}
                                        onChange={(e) =>
                                            setRoleId(e.target.value)
                                        }
                                    >
                                        {roles.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field
                                    label="Oficina"
                                    htmlFor="office_id"
                                    error={errors.office_id}
                                    hint={
                                        selectedRole?.scope === 'all'
                                            ? 'Opcional: este rol ve todas las oficinas.'
                                            : undefined
                                    }
                                >
                                    <NativeSelect
                                        id="office_id"
                                        name="office_id"
                                        defaultValue={user?.office_id ?? ''}
                                    >
                                        <option value="">
                                            {selectedRole?.scope === 'all'
                                                ? 'Todas'
                                                : 'Seleccione…'}
                                        </option>
                                        {offices.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <div />
                                <Field
                                    label={
                                        user ? 'Nueva contraseña' : 'Contraseña'
                                    }
                                    htmlFor="password"
                                    error={errors.password}
                                    hint={
                                        user
                                            ? 'Déjela en blanco para no cambiarla.'
                                            : undefined
                                    }
                                >
                                    <PasswordInput
                                        id="password"
                                        name="password"
                                        required={!user}
                                        autoComplete="new-password"
                                    />
                                </Field>
                                <Field
                                    label="Confirmar contraseña"
                                    htmlFor="password_confirmation"
                                >
                                    <PasswordInput
                                        id="password_confirmation"
                                        name="password_confirmation"
                                        required={!user}
                                        autoComplete="new-password"
                                    />
                                </Field>
                            </FormGrid>
                            <CheckboxField
                                name="is_active"
                                label="Usuario activo (puede ingresar)"
                                defaultChecked={user?.is_active ?? true}
                            />
                            <div className="flex gap-2">
                                <Button disabled={processing}>Guardar</Button>
                                <Button variant="ghost" asChild>
                                    <Link href={users.index()}>Cancelar</Link>
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </Panel>
        </Page>
    );
}

UserForm.layout = {
    breadcrumbs: [
        { title: 'Usuarios', href: users.index() },
        { title: 'Formulario', href: '#' },
    ],
};

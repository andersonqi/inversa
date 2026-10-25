import { Form, Head, Link } from '@inertiajs/react';
import type { ComponentProps } from 'react';
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

type AccessType = 'password' | 'pin';

type Secret = {
    label: string;
    newLabel: string;
    confirmLabel: string;
    hint: string;
    keepHint: string;
    input: Pick<
        ComponentProps<'input'>,
        'inputMode' | 'pattern' | 'minLength' | 'maxLength' | 'title'
    >;
};

/**
 * Clave de ingreso: contraseña de al menos 6 caracteres (sin mayúsculas, números ni
 * símbolos obligatorios) o PIN de 4 dígitos. Ambas se escriben en el campo
 * "Contraseña o PIN" al iniciar sesión.
 */
const SECRETS: Record<AccessType, Secret> = {
    password: {
        label: 'Contraseña',
        newLabel: 'Nueva contraseña',
        confirmLabel: 'Confirmar contraseña',
        hint: 'Mínimo 6 caracteres; no necesita mayúsculas, números ni símbolos.',
        keepHint: 'Déjela en blanco para no cambiarla.',
        input: { minLength: 6, maxLength: 72 },
    },
    pin: {
        label: 'PIN',
        newLabel: 'Nuevo PIN',
        confirmLabel: 'Confirmar PIN',
        hint: '4 números, por ejemplo 2580.',
        keepHint: 'Déjelo en blanco para no cambiarlo.',
        input: {
            inputMode: 'numeric',
            pattern: '[0-9]{4}',
            minLength: 4,
            maxLength: 4,
            title: 'El PIN debe tener 4 números.',
        },
    },
};

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
    const [accessType, setAccessType] = useState<AccessType>('password');
    const secret = SECRETS[accessType];

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
                                <Field
                                    label="Tipo de clave para ingresar"
                                    htmlFor="access_type"
                                >
                                    <NativeSelect
                                        id="access_type"
                                        value={accessType}
                                        onChange={(e) =>
                                            setAccessType(
                                                e.target.value === 'pin'
                                                    ? 'pin'
                                                    : 'password',
                                            )
                                        }
                                    >
                                        <option value="password">
                                            Contraseña
                                        </option>
                                        <option value="pin">
                                            PIN de 4 dígitos
                                        </option>
                                    </NativeSelect>
                                </Field>
                                <div className="hidden sm:block" />
                                <Field
                                    label={
                                        user ? secret.newLabel : secret.label
                                    }
                                    htmlFor="password"
                                    error={errors.password}
                                    hint={
                                        user
                                            ? `${secret.hint} ${secret.keepHint}`
                                            : secret.hint
                                    }
                                >
                                    <PasswordInput
                                        key={`password-${accessType}`}
                                        id="password"
                                        name="password"
                                        required={!user}
                                        autoComplete="new-password"
                                        {...secret.input}
                                    />
                                </Field>
                                <Field
                                    label={secret.confirmLabel}
                                    htmlFor="password_confirmation"
                                >
                                    <PasswordInput
                                        key={`confirmation-${accessType}`}
                                        id="password_confirmation"
                                        name="password_confirmation"
                                        required={!user}
                                        autoComplete="new-password"
                                        {...secret.input}
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

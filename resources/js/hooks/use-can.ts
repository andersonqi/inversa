import { usePage } from '@inertiajs/react';

/** Verifica permisos del rol del usuario autenticado. */
export function useCan(): (permission: string) => boolean {
    const { auth } = usePage().props;

    return (permission: string) => auth.permissions.includes(permission);
}

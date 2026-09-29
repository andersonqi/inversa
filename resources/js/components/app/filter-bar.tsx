import { router } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Formulario GET de filtros: se envía al cambiar un select/fecha o al presionar Enter.
 */
export function FilterBar({
    url,
    className,
    children,
}: {
    url: string;
    className?: string;
    children: ReactNode;
}) {
    const formRef = useRef<HTMLFormElement>(null);

    const submit = () => {
        if (!formRef.current) {
            return;
        }

        const data: Record<string, string> = {};

        new FormData(formRef.current).forEach((value, key) => {
            if (typeof value === 'string' && value !== '') {
                data[key] = value;
            }
        });

        router.get(url, data, { preserveState: true, replace: true });
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        submit();
    };

    const onChange = (e: FormEvent<HTMLFormElement>) => {
        const target = e.target as HTMLElement;

        if (
            target.tagName === 'SELECT' ||
            (target as HTMLInputElement).type === 'date' ||
            (target as HTMLInputElement).type === 'checkbox'
        ) {
            submit();
        }
    };

    return (
        <form
            ref={formRef}
            onSubmit={onSubmit}
            onChange={onChange}
            className={cn('flex flex-wrap items-end gap-3', className)}
        >
            {children}
            <button type="submit" className="hidden" />
        </form>
    );
}

export function FilterField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {label}
            {children}
        </label>
    );
}

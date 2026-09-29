import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Page({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('flex flex-1 flex-col gap-6 p-4 md:p-6', className)}>
            {children}
        </div>
    );
}

export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                </h1>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}

export function Panel({
    title,
    actions,
    className,
    children,
}: {
    title?: string;
    actions?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section
            className={cn(
                'rounded-xl border bg-card text-card-foreground',
                className,
            )}
        >
            {(title || actions) && (
                <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
                    <h2 className="text-sm font-semibold">{title}</h2>
                    {actions}
                </header>
            )}
            {children}
        </section>
    );
}

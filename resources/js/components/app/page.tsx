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
        <div
            className={cn(
                'mx-auto flex w-full flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8',
                className,
            )}
        >
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
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                    {title}
                </h1>
                {description && (
                    <p className="max-w-3xl text-sm text-muted-foreground">
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
                'overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-card',
                className,
            )}
        >
            {(title || actions) && (
                <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
                    <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
                        <span
                            aria-hidden="true"
                            className="h-4 w-1 rounded-full bg-primary"
                        />
                        {title}
                    </h2>
                    {actions}
                </header>
            )}
            {children}
        </section>
    );
}

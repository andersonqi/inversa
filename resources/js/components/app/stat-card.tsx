import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const toneStyles = {
    default: { value: '', chip: 'bg-primary/10 text-primary' },
    positive: {
        value: 'text-emerald-600 dark:text-emerald-400',
        chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    negative: {
        value: 'text-red-600 dark:text-red-400',
        chip: 'bg-red-500/10 text-red-600 dark:text-red-400',
    },
    warning: {
        value: 'text-amber-600 dark:text-amber-400',
        chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
} as const;

export function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    tone = 'default',
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: LucideIcon;
    tone?: 'default' | 'positive' | 'negative' | 'warning';
}) {
    const styles = toneStyles[tone];

    return (
        <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-primary/5 transition-transform duration-500 group-hover:scale-125"
            />
            <div className="relative flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                    {label}
                </p>
                {Icon && (
                    <span
                        className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-xl',
                            styles.chip,
                        )}
                    >
                        <Icon className="size-4.5" />
                    </span>
                )}
            </div>
            <p
                className={cn(
                    'relative mt-2 font-display text-[1.75rem] leading-tight font-semibold tracking-tight tabular-nums',
                    styles.value,
                )}
            >
                {value}
            </p>
            {hint && (
                <p className="relative mt-1 text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
        </div>
    );
}

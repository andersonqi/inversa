import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{label}</p>
                {Icon && <Icon className="size-4 text-brass" />}
            </div>
            <p
                className={cn(
                    'mt-2 font-display text-[1.75rem] leading-tight font-semibold tracking-tight tabular-nums',
                    tone === 'positive' &&
                        'text-emerald-600 dark:text-emerald-400',
                    tone === 'negative' && 'text-red-600 dark:text-red-400',
                    tone === 'warning' && 'text-amber-600 dark:text-amber-400',
                )}
            >
                {value}
            </p>
            {hint && (
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            )}
        </div>
    );
}

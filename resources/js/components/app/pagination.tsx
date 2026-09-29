import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types';

export function Pagination<T>({ page }: { page: Paginated<T> }) {
    if (page.last_page <= 1) {
        return page.total > 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">
                {page.total} registro{page.total === 1 ? '' : 's'}
            </p>
        ) : null;
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
                {page.from}–{page.to} de {page.total}
            </p>
            <nav className="flex flex-wrap gap-1">
                {page.links.map((link, i) => {
                    const label = link.label
                        .replace('&laquo;', '‹')
                        .replace('&raquo;', '›')
                        .replace(/Previous|Anterior/, '')
                        .replace(/Next|Siguiente/, '')
                        .trim();

                    return link.url ? (
                        <Link
                            key={i}
                            href={link.url}
                            preserveScroll
                            preserveState
                            className={cn(
                                'min-w-8 rounded-md border px-2 py-1 text-center text-xs',
                                link.active
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'hover:bg-muted',
                            )}
                        >
                            {label}
                        </Link>
                    ) : (
                        <span
                            key={i}
                            className="min-w-8 rounded-md border px-2 py-1 text-center text-xs text-muted-foreground opacity-50"
                        >
                            {label}
                        </span>
                    );
                })}
            </nav>
        </div>
    );
}

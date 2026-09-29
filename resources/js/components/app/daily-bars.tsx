import { useState } from 'react';
import { date, money } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Barras verticales de una sola serie por día, con tooltip al pasar el cursor.
 */
export function DailyBars({
    data,
}: {
    data: { date: string; value: number }[];
}) {
    const [hover, setHover] = useState<number | null>(null);
    const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
    const hovered = hover !== null ? data[hover] : null;

    return (
        <div className="relative">
            <div
                className="flex h-44 items-end gap-0.5 border-b border-border"
                role="img"
                aria-label="Ganancia de la empresa por día"
            >
                {data.map((d, i) => (
                    <div
                        key={d.date}
                        className="group flex h-full flex-1 cursor-default items-end"
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                    >
                        <div
                            className={cn(
                                'w-full rounded-t transition-opacity',
                                d.value < 0 ? 'bg-red-500/70' : 'bg-primary/80',
                                hover !== null && hover !== i && 'opacity-40',
                            )}
                            style={{
                                height: `${Math.max(d.value === 0 ? 0 : 2, (Math.abs(d.value) / max) * 100)}%`,
                            }}
                        />
                    </div>
                ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{date(data[0]?.date)}</span>
                <span>{date(data[data.length - 1]?.date)}</span>
            </div>
            {hovered && (
                <div
                    className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
                    style={{ left: `${((hover! + 0.5) / data.length) * 100}%` }}
                >
                    <p className="text-muted-foreground">
                        {date(hovered.date)}
                    </p>
                    <p className="font-semibold tabular-nums">
                        {money(hovered.value)}
                    </p>
                </div>
            )}
        </div>
    );
}

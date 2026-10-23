import { num } from '@/lib/format';

/**
 * Gráfico de dona de avance (parte / total) con el porcentaje al centro.
 */
export function Donut({
    value,
    total,
    label,
    hint,
}: {
    value: number;
    total: number;
    label: string;
    hint?: string;
}) {
    const ratio = total > 0 ? Math.min(1, value / total) : 0;
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const color =
        ratio >= 1
            ? 'stroke-emerald-500'
            : ratio >= 0.5
              ? 'stroke-amber-500'
              : 'stroke-red-500';

    return (
        <figure className="flex items-center gap-4">
            <svg
                viewBox="0 0 100 100"
                className="size-28 shrink-0"
                role="img"
                aria-label={`${label}: ${value} de ${total}`}
            >
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    strokeWidth="12"
                    className="stroke-muted"
                />
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    strokeWidth="12"
                    strokeLinecap={ratio > 0 ? 'round' : 'butt'}
                    strokeDasharray={`${ratio * circumference} ${circumference}`}
                    transform="rotate(-90 50 50)"
                    className={`${color} transition-all`}
                />
                <text
                    x="50"
                    y="50"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-foreground text-[20px] font-semibold"
                >
                    {Math.round(ratio * 100)}%
                </text>
            </svg>
            <figcaption>
                <p className="text-sm font-medium">{label}</p>
                <p className="font-display text-2xl font-semibold tabular-nums">
                    {num(value)}{' '}
                    <span className="text-base text-muted-foreground">
                        / {num(total)}
                    </span>
                </p>
                {hint && (
                    <p className="text-xs text-muted-foreground">{hint}</p>
                )}
            </figcaption>
        </figure>
    );
}

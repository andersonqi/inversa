import { cn } from '@/lib/utils';

const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
    red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400',
    blue: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400',
    gray: 'bg-muted text-muted-foreground ring-border',
} as const;

export type Tone = keyof typeof tones;

export function Pill({
    tone = 'gray',
    children,
}: {
    tone?: Tone;
    children: React.ReactNode;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                tones[tone],
            )}
        >
            {children}
        </span>
    );
}

export function ActiveBadge({ active }: { active: boolean }) {
    return (
        <Pill tone={active ? 'green' : 'gray'}>
            {active ? 'Activo' : 'Inactivo'}
        </Pill>
    );
}

const machineStatus: Record<string, [string, Tone]> = {
    warehouse: ['En bodega', 'gray'],
    installed: ['Instalada', 'green'],
    maintenance: ['Mantenimiento', 'amber'],
    retired: ['Dada de baja', 'red'],
};

export function MachineStatusBadge({ status }: { status: string }) {
    const [label, tone] = machineStatus[status] ?? [status, 'gray'];

    return <Pill tone={tone}>{label}</Pill>;
}

const loanStatus: Record<string, [string, Tone]> = {
    active: ['Activo', 'blue'],
    paid: ['Pagado', 'green'],
    cancelled: ['Anulado', 'gray'],
};

export function LoanStatusBadge({ status }: { status: string }) {
    const [label, tone] = loanStatus[status] ?? [status, 'gray'];

    return <Pill tone={tone}>{label}</Pill>;
}

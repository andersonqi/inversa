import { useForm } from '@inertiajs/react';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { Tone } from '@/components/app/badges';
import { Pill } from '@/components/app/badges';
import { Field } from '@/components/app/field';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/use-can';
import { gtq } from '@/lib/format';
import { cn } from '@/lib/utils';
import parameters from '@/routes/parameters';
import type { PerformanceLevel, PerformanceThresholdsInfo } from '@/types';

export const PERFORMANCE_LEVELS: Record<
    PerformanceLevel,
    { label: string; tone: Tone }
> = {
    excellent: { label: 'Excelente', tone: 'green' },
    good: { label: 'Bueno', tone: 'blue' },
    poor: { label: 'Insuficiente', tone: 'red' },
};

/** Misma regla que el servidor (PerformanceThresholds::classify). */
export function classifyWeekly(
    weekly: number,
    thresholds: Pick<PerformanceThresholdsInfo, 'excellent' | 'poor'>,
): PerformanceLevel {
    if (weekly >= thresholds.excellent) {
        return 'excellent';
    }

    return weekly < thresholds.poor ? 'poor' : 'good';
}

export function PerformanceBadge({ level }: { level: PerformanceLevel }) {
    const { label, tone } = PERFORMANCE_LEVELS[level];

    return <Pill tone={tone}>{label}</Pill>;
}

/** Texto con los rangos vigentes de cada clasificación. */
export function thresholdsSummary(
    thresholds: Pick<PerformanceThresholdsInfo, 'excellent' | 'poor'>,
): string {
    return `Por semana: Excelente desde ${gtq(thresholds.excellent)} · Bueno de ${gtq(thresholds.poor)} a menos de ${gtq(thresholds.excellent)} · Insuficiente debajo de ${gtq(thresholds.poor)}.`;
}

/**
 * Botón y diálogo para ajustar los montos de la clasificación (solo con el permiso
 * "Configurar parámetros"). Ofrece montos sugeridos y permite escribir uno propio.
 */
export function PerformanceThresholdsEditor({
    thresholds,
}: {
    thresholds: PerformanceThresholdsInfo;
}) {
    const can = useCan();
    const [open, setOpen] = useState(false);
    const form = useForm({
        excellent: String(thresholds.excellent),
        poor: String(thresholds.poor),
    });

    if (!can('settings.manage')) {
        return null;
    }

    const excellent = Number(form.data.excellent);
    const poor = Number(form.data.poor);
    const invalid =
        !(excellent > 0) ||
        form.data.poor === '' ||
        poor < 0 ||
        poor >= excellent;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put(parameters.performance().url, {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                setOpen(value);

                if (value) {
                    form.setData({
                        excellent: String(thresholds.excellent),
                        poor: String(thresholds.poor),
                    });
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <SlidersHorizontal /> Ajustar montos
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogTitle>Clasificación por rendimiento</DialogTitle>
                <DialogDescription>
                    Se compara la ganancia neta promedio por semana de cada
                    máquina (en quetzales). Elija un monto sugerido o escriba
                    uno propio.
                </DialogDescription>
                <form onSubmit={submit} className="grid gap-5">
                    <AmountChooser
                        id="excellent"
                        label="Excelente desde (Q por semana)"
                        tone="green"
                        presets={thresholds.excellent_presets}
                        value={form.data.excellent}
                        onChange={(value) => form.setData('excellent', value)}
                        error={form.errors.excellent}
                    />
                    <AmountChooser
                        id="poor"
                        label="Insuficiente por debajo de (Q por semana)"
                        tone="red"
                        presets={thresholds.poor_presets}
                        value={form.data.poor}
                        onChange={(value) => form.setData('poor', value)}
                        error={
                            form.errors.poor ??
                            (form.data.poor !== '' &&
                            excellent > 0 &&
                            poor >= excellent
                                ? 'Debe ser menor que el monto de Excelente.'
                                : undefined)
                        }
                    />
                    {!invalid && (
                        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            {thresholdsSummary({ excellent, poor })}
                        </p>
                    )}
                    <DialogFooter>
                        <Button disabled={form.processing || invalid}>
                            Guardar montos
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AmountChooser({
    id,
    label,
    tone,
    presets,
    value,
    onChange,
    error,
}: {
    id: string;
    label: string;
    tone: 'green' | 'red';
    presets: number[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <Field label={label} htmlFor={id} error={error}>
            <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => {
                    const selected = Number(value) === preset;

                    return (
                        <button
                            key={preset}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChange(String(preset))}
                            className={cn(
                                'rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors',
                                selected
                                    ? tone === 'green'
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-red-600 bg-red-600 text-white'
                                    : 'hover:bg-muted',
                            )}
                        >
                            {gtq(preset)}
                        </button>
                    );
                })}
            </div>
            <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                    Q
                </span>
                <Input
                    id={id}
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    className="pl-7 tabular-nums"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Otro monto"
                    required
                />
            </div>
        </Field>
    );
}

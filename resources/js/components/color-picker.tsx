import { Check, Pipette } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { BRAND_PRESETS, contrastFor } from '@/lib/brand-theme';
import { cn } from '@/lib/utils';

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Selector de color: muestras sugeridas y un color personalizado (paleta o código #rrggbb).
 */
export function ColorPicker({
    value,
    onChange,
}: {
    value: string;
    onChange: (color: string) => void;
}) {
    const [text, setText] = useState(value);
    const isPreset = BRAND_PRESETS.some(
        (p) => p.color.toLowerCase() === value.toLowerCase(),
    );

    const pick = (color: string) => {
        setText(color);
        onChange(color.toLowerCase());
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {BRAND_PRESETS.map((preset) => {
                    const selected =
                        preset.color.toLowerCase() === value.toLowerCase();

                    return (
                        <button
                            key={preset.color}
                            type="button"
                            title={preset.name}
                            aria-label={preset.name}
                            aria-pressed={selected}
                            onClick={() => pick(preset.color)}
                            className={cn(
                                'flex aspect-square items-center justify-center rounded-xl shadow-sm ring-offset-2 ring-offset-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                selected && 'ring-2 ring-foreground',
                            )}
                            style={{ backgroundColor: preset.color }}
                        >
                            {selected && (
                                <Check
                                    className="size-4"
                                    style={{ color: contrastFor(preset.color) }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center gap-3">
                <label
                    className={cn(
                        'relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border shadow-sm',
                        !isPreset && 'ring-2 ring-foreground ring-offset-2',
                    )}
                    style={{ backgroundColor: HEX.test(value) ? value : '#ffffff' }}
                    title="Color personalizado"
                >
                    <Pipette
                        className="size-4"
                        style={{
                            color: HEX.test(value)
                                ? contrastFor(value)
                                : '#111827',
                        }}
                    />
                    <input
                        type="color"
                        value={HEX.test(value) ? value : '#000000'}
                        onChange={(e) => pick(e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Elegir color personalizado"
                    />
                </label>
                <Input
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);

                        if (HEX.test(e.target.value)) {
                            onChange(e.target.value.toLowerCase());
                        }
                    }}
                    maxLength={7}
                    placeholder="#0e5a4a"
                    className="w-32 font-mono uppercase"
                    aria-label="Código del color"
                />
                <span className="text-xs text-muted-foreground">
                    Color personalizado
                </span>
            </div>
        </div>
    );
}

/** Vista previa del aspecto de la interfaz con un color. */
export function ThemePreview({ color }: { color: string }) {
    const deep = `color-mix(in oklab, ${color} 42%, #050807)`;

    return (
        <div className="flex h-36 overflow-hidden rounded-2xl border shadow-card">
            <div
                className="flex w-24 flex-col gap-2 p-3"
                style={{
                    backgroundImage: `linear-gradient(180deg, color-mix(in oklab, ${color} 52%, #000) 0%, ${deep} 60%)`,
                }}
            >
                <span className="size-6 rounded-md bg-[#c9973a]" />
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="h-2 rounded-full"
                        style={{
                            backgroundColor:
                                i === 0
                                    ? 'rgba(255,255,255,0.75)'
                                    : 'rgba(255,255,255,0.3)',
                        }}
                    />
                ))}
            </div>
            <div
                className="flex flex-1 flex-col gap-2 p-3"
                style={{
                    backgroundColor: `color-mix(in oklab, ${color} 3%, #f5f6f8)`,
                }}
            >
                <span className="h-2.5 w-24 rounded-full bg-black/15" />
                <div className="flex gap-2">
                    <span className="h-12 flex-1 rounded-lg bg-white shadow-sm" />
                    <span className="h-12 flex-1 rounded-lg bg-white shadow-sm" />
                </div>
                <span
                    className="mt-auto inline-flex h-7 w-28 items-center justify-center rounded-md text-[11px] font-semibold"
                    style={{ backgroundColor: color, color: contrastFor(color) }}
                >
                    Registrar corte
                </span>
            </div>
        </div>
    );
}

import { Camera, ImageOff, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Field } from '@/components/app/field';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { compressImage } from '@/lib/image';
import { cn } from '@/lib/utils';

/**
 * Campo de foto para formularios de Inertia (<Form>). Permite tomar la foto con la
 * cámara o elegirla de la galería; se reduce en el teléfono antes de subirla. "Quitar"
 * envía `remove_{name}` = 1 para borrar la foto guardada.
 */
export function PhotoField({
    name,
    label,
    currentUrl,
    error,
    hint,
    className,
}: {
    name: string;
    label: string;
    currentUrl: string | null;
    error?: string;
    hint?: string;
    className?: string;
}) {
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [removed, setRemoved] = useState(false);
    const [busy, setBusy] = useState(false);
    const shown = preview ?? (removed ? null : currentUrl);

    const pick = async (input: HTMLInputElement) => {
        const selected = input.files?.[0];

        if (!selected) {
            return;
        }

        setBusy(true);
        let file = selected;
        const compressed = await compressImage(selected, `${name}.jpg`);

        if (compressed !== selected) {
            try {
                // Se reemplaza el archivo del campo por la versión reducida.
                const transfer = new DataTransfer();
                transfer.items.add(compressed);
                input.files = transfer.files;
                file = compressed;
            } catch {
                // Navegador sin DataTransfer: se sube la foto original.
            }
        }

        const reader = new FileReader();
        reader.onload = () =>
            setPreview(
                typeof reader.result === 'string' ? reader.result : null,
            );
        reader.readAsDataURL(file);
        setRemoved(false);
        setBusy(false);
    };

    const remove = () => {
        setPreview(null);
        setRemoved(true);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <Field
            label={label}
            htmlFor={id}
            error={error}
            hint={hint}
            className={className}
        >
            <input
                ref={inputRef}
                id={id}
                name={name}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pick(e.currentTarget)}
            />
            <input
                type="hidden"
                name={`remove_${name}`}
                value={removed ? '1' : '0'}
            />
            <div className="flex flex-wrap items-end gap-3">
                {shown ? (
                    <img
                        src={shown}
                        alt={label}
                        className="aspect-[4/3] w-40 rounded-lg border object-cover"
                    />
                ) : (
                    <div className="flex aspect-[4/3] w-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground">
                        <ImageOff className="size-5" />
                        Sin foto
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => inputRef.current?.click()}
                    >
                        <Camera />
                        {busy
                            ? 'Procesando…'
                            : shown
                              ? 'Cambiar foto'
                              : 'Tomar o elegir foto'}
                    </Button>
                    {shown && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={remove}
                        >
                            <Trash2 /> Quitar foto
                        </Button>
                    )}
                </div>
            </div>
        </Field>
    );
}

/** Miniatura que se amplía al tocarla. */
export function PhotoCard({
    src,
    label,
    className,
}: {
    src: string;
    label: string;
    className?: string;
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'group block w-full overflow-hidden rounded-xl border bg-card text-left',
                        className,
                    )}
                >
                    <img
                        src={src}
                        alt={label}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                    <span className="block px-3 py-2 text-xs text-muted-foreground">
                        {label}
                    </span>
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
                <DialogTitle>{label}</DialogTitle>
                <DialogDescription className="sr-only">
                    Foto ampliada
                </DialogDescription>
                <img
                    src={src}
                    alt={label}
                    className="max-h-[75vh] w-full rounded-lg object-contain"
                />
            </DialogContent>
        </Dialog>
    );
}

import { Head, useForm } from '@inertiajs/react';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { ColorPicker, ThemePreview } from '@/components/color-picker';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { edit as editBranding, update } from '@/routes/branding';

export default function Branding({
    color,
    defaultColor,
    logoUrl,
}: {
    color: string;
    defaultColor: string;
    logoUrl: string | null;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [pickerKey, setPickerKey] = useState(0);

    const form = useForm<{
        color: string;
        logo: File | null;
        remove_logo: boolean;
    }>({
        color,
        logo: null,
        remove_logo: false,
    });

    const shownLogo = form.data.remove_logo ? null : (preview ?? logoUrl);

    const pickLogo = (file: File | undefined) => {
        if (!file) {
            return;
        }

        form.setData((data) => ({ ...data, logo: file, remove_logo: false }));
        const reader = new FileReader();
        reader.onload = () =>
            setPreview(typeof reader.result === 'string' ? reader.result : null);
        reader.readAsDataURL(file);
    };

    const removeLogo = () => {
        form.setData((data) => ({ ...data, logo: null, remove_logo: true }));
        setPreview(null);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(update().url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setPreview(null);
                form.setData((data) => ({
                    ...data,
                    logo: null,
                    remove_logo: false,
                }));
            },
        });
    };

    return (
        <>
            <Head title="Identidad de la empresa" />
            <h1 className="sr-only">Identidad de la empresa</h1>

            <form onSubmit={submit} className="space-y-12">
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title="Logo"
                        description="Se muestra en el menú, en la pantalla de ingreso y en los recibos. PNG, JPG o WEBP de hasta 2 MB; mejor cuadrado y con fondo claro."
                    />
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border bg-white p-2 shadow-card">
                            {shownLogo ? (
                                <img
                                    src={shownLogo}
                                    alt="Logo de la empresa"
                                    className="size-full object-contain"
                                />
                            ) : (
                                <AppLogoIcon className="size-full" />
                            )}
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => pickLogo(e.target.files?.[0])}
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => inputRef.current?.click()}
                            >
                                <ImageUp /> Subir logo
                            </Button>
                            {shownLogo && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={removeLogo}
                                >
                                    <Trash2 /> Quitar logo
                                </Button>
                            )}
                        </div>
                    </div>
                    {!shownLogo && (
                        <p className="text-xs text-muted-foreground">
                            Sin logo propio se usa la marca de Inversa.
                        </p>
                    )}
                    <InputError message={form.errors.logo} />
                </div>

                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title="Color de la empresa"
                        description="Color predeterminado del sistema para todos los usuarios. Cada usuario puede elegir el suyo en Apariencia."
                    />
                    <ColorPicker
                        key={pickerKey}
                        value={form.data.color}
                        onChange={(value) => form.setData('color', value)}
                    />
                    <ThemePreview color={form.data.color} />
                    <InputError message={form.errors.color} />
                    {form.data.color !== defaultColor && (
                        <button
                            type="button"
                            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                            onClick={() => {
                                form.setData('color', defaultColor);
                                setPickerKey((k) => k + 1);
                            }}
                        >
                            Volver al verde original de Inversa
                        </button>
                    )}
                </div>

                <Button disabled={form.processing}>
                    {form.processing ? 'Guardando…' : 'Guardar identidad'}
                </Button>
            </form>
        </>
    );
}

Branding.layout = {
    breadcrumbs: [
        {
            title: 'Identidad de la empresa',
            href: editBranding(),
        },
    ],
};

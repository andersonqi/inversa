import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import AppearanceTabs from '@/components/appearance-tabs';
import { ColorPicker, ThemePreview } from '@/components/color-picker';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { applyBrandColor } from '@/lib/brand-theme';
import { color as saveColor, edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    const { auth, theme } = usePage().props;
    const companyColor = theme?.company_color ?? '#0e5a4a';
    const personal =
        typeof auth.user.accent_color === 'string'
            ? auth.user.accent_color
            : null;
    const [color, setColor] = useState(personal ?? companyColor);
    const [pickerKey, setPickerKey] = useState(0);
    const [saving, setSaving] = useState(false);

    const save = (accentColor: string | null) => {
        router.patch(
            saveColor().url,
            { accent_color: accentColor },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
            },
        );
    };

    const preview = (value: string) => {
        setColor(value);
        // Vista previa inmediata en toda la interfaz; se guarda con el botón.
        applyBrandColor(value);
    };

    const useCompany = () => {
        setColor(companyColor);
        setPickerKey((k) => k + 1);
        applyBrandColor(companyColor);
        save(null);
    };

    return (
        <>
            <Head title="Configuración de apariencia" />

            <h1 className="sr-only">Configuración de apariencia</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Modo claro u oscuro"
                    description="También puede cambiarlo tocando el logo del menú."
                />
                <AppearanceTabs />
            </div>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Color de la interfaz"
                    description="Elija el color con que quiere ver el sistema. Solo cambia para usted."
                />
                <ColorPicker key={pickerKey} value={color} onChange={preview} />
                <ThemePreview color={color} />
                <div className="flex flex-wrap gap-2">
                    <Button
                        disabled={saving || color === (personal ?? '')}
                        onClick={() => save(color)}
                    >
                        Guardar color
                    </Button>
                    <Button
                        variant="outline"
                        disabled={saving || personal === null}
                        onClick={useCompany}
                    >
                        Usar el color de la empresa
                    </Button>
                </div>
                {personal === null && (
                    <p className="text-xs text-muted-foreground">
                        Actualmente usa el color de la empresa.
                    </p>
                )}
            </div>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Configuración de apariencia',
            href: editAppearance(),
        },
    ],
};

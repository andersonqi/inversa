import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { cn } from '@/lib/utils';

/**
 * Logo de la empresa: el que subió el administrador o, si no hay, la marca de Inversa.
 */
export function BrandMark({ className }: { className?: string }) {
    const logoUrl = usePage().props.theme?.logo_url ?? null;
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    if (logoUrl && failedUrl !== logoUrl) {
        return (
            <img
                src={logoUrl}
                alt="Logo de la empresa"
                className={cn(
                    'rounded-lg bg-white object-contain p-0.5',
                    className,
                )}
                onError={() => setFailedUrl(logoUrl)}
            />
        );
    }

    return <AppLogoIcon className={className} />;
}

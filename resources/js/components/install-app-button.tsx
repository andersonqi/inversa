import type { LucideIcon } from 'lucide-react';
import {
    Download,
    EllipsisVertical,
    MonitorDown,
    Share,
    SquarePlus,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import type { InstallPlatform } from '@/lib/install-app';
import {
    installPlatform,
    promptInstall,
    useInstallApp,
} from '@/lib/install-app';

type Step = { icon: LucideIcon; text: string };

/** Pasos para instalar a mano cuando el navegador no ofrece el diálogo. */
const STEPS: Record<InstallPlatform, Step[]> = {
    ios: [
        {
            icon: Share,
            text: 'Toque el botón Compartir de Safari (abajo en el iPhone, arriba en el iPad).',
        },
        { icon: SquarePlus, text: 'Elija «Agregar a inicio».' },
        {
            icon: Download,
            text: 'Toque «Agregar». Si no ve la opción, abra esta página en Safari.',
        },
    ],
    android: [
        {
            icon: EllipsisVertical,
            text: 'Toque el menú ⋮ de Chrome (arriba a la derecha).',
        },
        {
            icon: SquarePlus,
            text: 'Elija «Instalar aplicación» o «Agregar a la pantalla principal».',
        },
        { icon: Download, text: 'Confirme con «Instalar».' },
    ],
    desktop: [
        {
            icon: MonitorDown,
            text: 'En Chrome o Edge, toque el ícono de instalar al final de la barra de direcciones.',
        },
        {
            icon: EllipsisVertical,
            text: 'O abra el menú ⋮ y elija «Instalar Inversa».',
        },
    ],
};

/**
 * Botón de la cabecera para agregar el sistema a la pantalla principal como app. Usa el
 * diálogo del navegador si está disponible; si no (iPhone, o Chrome sin aviso), muestra
 * los pasos. No aparece si ya se abrió como app instalada.
 */
export function InstallAppButton() {
    const { canPrompt, installed } = useInstallApp();
    const [open, setOpen] = useState(false);
    const platform = installPlatform();

    // En computadora solo se ofrece si el navegador permite instalar.
    if (installed || (!canPrompt && platform === 'desktop')) {
        return null;
    }

    const install = async () => {
        const outcome = await promptInstall();

        if (outcome === 'unavailable') {
            setOpen(true);
        } else if (outcome === 'accepted') {
            toast.success('Listo: la app se agregó a la pantalla principal.');
        }
    };

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => void install()}>
                <Download />
                Instalar app
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogTitle>Agregar a la pantalla principal</DialogTitle>
                    <DialogDescription>
                        El sistema se abrirá como una aplicación: a pantalla
                        completa y con su propio ícono en el teléfono.
                    </DialogDescription>
                    <ol className="space-y-3 text-sm">
                        {STEPS[platform].map((step, index) => (
                            <li
                                key={step.text}
                                className="flex items-start gap-3"
                            >
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <step.icon className="size-4" />
                                </span>
                                <span className="pt-1">
                                    {index + 1}. {step.text}
                                </span>
                            </li>
                        ))}
                    </ol>
                    <DialogFooter>
                        <Button onClick={() => setOpen(false)}>
                            Entendido
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

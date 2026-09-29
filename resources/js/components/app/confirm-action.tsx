import { router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Botón con diálogo de confirmación que ejecuta una petición (por defecto DELETE).
 */
export function ConfirmAction({
    url,
    method = 'delete',
    title,
    description,
    confirmLabel = 'Eliminar',
    trigger,
}: {
    url: string;
    method?: 'delete' | 'post';
    title: string;
    description?: ReactNode;
    confirmLabel?: string;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const confirm = () => {
        router.visit(url, {
            method,
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                setOpen(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogTitle>{title}</DialogTitle>
                {description && (
                    <DialogDescription>{description}</DialogDescription>
                )}
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={processing}
                        onClick={confirm}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

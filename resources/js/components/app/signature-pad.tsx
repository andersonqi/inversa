import { Eraser } from 'lucide-react';
import type { PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Canvas de firma táctil. Entrega la firma como data URL PNG (o null si se borra).
 */
export function SignaturePad({
    onChange,
    className,
}: {
    onChange: (dataUrl: string | null) => void;
    className?: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [empty, setEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!canvas || !ctx) {
            return;
        }

        // Resolución real del dispositivo para que el trazo no se vea borroso.
        const ratio = window.devicePixelRatio || 1;
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111827';
    }, []);

    const context = () => canvasRef.current?.getContext('2d') ?? null;

    const point = (e: PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();

        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: PointerEvent<HTMLCanvasElement>) => {
        const ctx = context();

        if (!ctx) {
            return;
        }

        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const { x, y } = point(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.1, y + 0.1);
        ctx.stroke();
    };

    const move = (e: PointerEvent<HTMLCanvasElement>) => {
        const ctx = context();

        if (!drawing.current || !ctx) {
            return;
        }

        const { x, y } = point(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const end = () => {
        if (!drawing.current || !canvasRef.current) {
            return;
        }

        drawing.current = false;
        setEmpty(false);
        onChange(canvasRef.current.toDataURL('image/png'));
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = context();

        if (!canvas || !ctx) {
            return;
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        setEmpty(true);
        onChange(null);
    };

    return (
        <div className={cn('space-y-2', className)}>
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    aria-label="Área de firma"
                    className="h-40 w-full touch-none rounded-lg border border-dashed bg-white"
                    onPointerDown={start}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerLeave={end}
                    onPointerCancel={end}
                />
                {empty && (
                    <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                        Firme aquí con el dedo
                    </p>
                )}
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clear}
                disabled={empty}
            >
                <Eraser /> Borrar firma
            </Button>
        </div>
    );
}

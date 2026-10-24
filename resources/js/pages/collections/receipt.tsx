import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Download,
    FileText,
    Image as ImageIcon,
    MessageCircle,
    Printer,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
// El recibo es un comprobante: siempre en quetzales, sin importar la moneda elegida.
import { date, gtq as money, num, percent } from '@/lib/format';
import type { PaperWidth } from '@/lib/receipt-file';
import {
    buildReceiptFiles,
    downloadFile,
    receiptCaption,
    receiptNumber,
    receiptText,
    receiptTime as time,
    shareFile,
} from '@/lib/receipt-file';
import { whatsappUrl } from '@/lib/route-tools';
import { cn } from '@/lib/utils';
import clients from '@/routes/clients';
import collections from '@/routes/collections';
import type { Collection } from '@/types';

type Copy = 'cliente' | 'empresa';
type Width = PaperWidth;
type FileFormat = 'image' | 'pdf';

const WIDTH_KEY = 'receipt-width';

function storedWidth(): Width {
    if (typeof window === 'undefined') {
        return 58;
    }

    return window.localStorage.getItem(WIDTH_KEY) === '80' ? 80 : 58;
}

export default function CollectionReceipt({
    collection: c,
    loansBalance,
}: {
    collection: Collection;
    loansBalance: number;
}) {
    const { name: company } = usePage().props;
    const [width, setWidth] = useState<Width>(storedWidth);
    const [copy, setCopy] = useState<Copy>('cliente');

    const changeWidth = (value: Width) => {
        setWidth(value);
        window.localStorage.setItem(WIDTH_KEY, String(value));
    };

    const print = (value: Copy) => {
        // Se renderiza la copia elegida antes de abrir el diálogo de impresión.
        flushSync(() => setCopy(value));
        window.print();
    };

    // El ticket como imagen y PDF se prepara de antemano: el menú "Compartir" del
    // teléfono debe abrirse en el mismo toque del botón.
    const signatureUrl = c.signature_path
        ? collections.signature(c.id).url
        : null;
    const [format, setFormat] = useState<FileFormat>('image');
    const [files, setFiles] = useState<{
        width: Width;
        image: File;
        pdf: File;
    } | null>(null);
    const [failed, setFailed] = useState(false);
    const ready = files?.width === width ? files : null;
    const caption = receiptCaption(company, c);

    useEffect(() => {
        let active = true;

        buildReceiptFiles(company, c, loansBalance, width, signatureUrl)
            .then((built) => {
                if (active) {
                    setFiles({ width, ...built });
                }
            })
            .catch(() => {
                if (active) {
                    setFailed(true);
                }
            });

        return () => {
            active = false;
        };
    }, [company, c, loansBalance, width, signatureUrl]);

    const shareTicket = async () => {
        if (!ready) {
            return;
        }

        const file = format === 'pdf' ? ready.pdf : ready.image;
        const result = await shareFile(file, caption);

        if (result === 'unsupported') {
            // Computadoras y navegadores sin "Compartir archivos": se descarga y se
            // abre el chat para adjuntarlo.
            downloadFile(file);
            window.open(
                whatsappUrl(
                    c.client?.phone,
                    `${caption}\n\n(Adjunto: ${file.name})`,
                ),
                '_blank',
                'noopener',
            );
            toast.info(
                'Este navegador no permite adjuntar archivos directamente: el ticket se descargó, adjúntelo en el chat de WhatsApp.',
            );
        }
    };

    const items = c.items ?? [];
    const isCompany = copy === 'empresa';

    return (
        <div className="min-h-screen bg-muted py-6 print:bg-white print:py-0">
            <Head title={`Recibo #${receiptNumber(c.id)}`} />
            <style>{`@page { size: ${width}mm auto; margin: 0; }`}</style>

            <div className="mx-auto mb-6 flex max-w-xl flex-col gap-3 px-4 print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={collections.show(c.id)}>
                            <ArrowLeft /> Ver corte
                        </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={clients.index()}>Volver a la ruta</Link>
                    </Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Papel:</span>
                    {([58, 80] as const).map((w) => (
                        <Button
                            key={w}
                            size="sm"
                            variant={width === w ? 'default' : 'outline'}
                            onClick={() => changeWidth(w)}
                        >
                            {w} mm
                        </Button>
                    ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                    <Button onClick={() => print('cliente')}>
                        <Printer /> Imprimir para cliente
                    </Button>
                    <Button variant="outline" onClick={() => print('empresa')}>
                        <Printer /> Imprimir para empresa
                    </Button>
                </div>

                <section className="space-y-2 rounded-lg border bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                            Enviar ticket por WhatsApp
                        </p>
                        <div
                            className="flex gap-1"
                            role="group"
                            aria-label="Formato del ticket"
                        >
                            <Button
                                size="sm"
                                variant={
                                    format === 'image' ? 'default' : 'outline'
                                }
                                onClick={() => setFormat('image')}
                            >
                                <ImageIcon /> Imagen
                            </Button>
                            <Button
                                size="sm"
                                variant={
                                    format === 'pdf' ? 'default' : 'outline'
                                }
                                onClick={() => setFormat('pdf')}
                            >
                                <FileText /> PDF
                            </Button>
                        </div>
                    </div>
                    <Button
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={!ready}
                        onClick={() => void shareTicket()}
                    >
                        <MessageCircle />
                        {ready
                            ? `Enviar ${format === 'pdf' ? 'PDF' : 'imagen'} del ticket`
                            : failed
                              ? 'No se pudo preparar el ticket'
                              : 'Preparando ticket…'}
                    </Button>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <a
                            href={whatsappUrl(
                                c.client?.phone,
                                receiptText(company, c, loansBalance),
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                        >
                            Enviar solo como texto
                        </a>
                        {ready && (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline"
                                onClick={() =>
                                    downloadFile(
                                        format === 'pdf'
                                            ? ready.pdf
                                            : ready.image,
                                    )
                                }
                            >
                                <Download className="size-3.5" /> Descargar{' '}
                                {format === 'pdf' ? 'PDF' : 'imagen'}
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        En el teléfono se abre el menú «Compartir» con el
                        ticket adjunto: elija WhatsApp y el contacto del
                        cliente. Se envía la copia del cliente, en quetzales.
                    </p>
                </section>
                <p className="text-xs text-muted-foreground">
                    Vista previa: copia de {copy}.
                </p>
            </div>

            <article
                className={cn(
                    'mx-auto bg-white p-3 font-mono leading-snug text-black shadow print:p-1 print:shadow-none',
                    width === 58 ? 'w-[58mm] text-[10px]' : 'w-[80mm] text-xs',
                )}
            >
                <header className="text-center">
                    <p className="text-[1.3em] font-bold uppercase">
                        {company}
                    </p>
                    <p>Recibo de corte</p>
                    <p className="font-bold">#{receiptNumber(c.id)}</p>
                </header>

                <Divider />
                <Line label="Fecha" value={date(c.collected_on)} />
                <Line label="Hora" value={time(c.created_at)} />
                <Line label="Ruta" value={c.collection_route?.code ?? ''} />
                <Line label="Cobrador" value={c.user?.name ?? ''} />
                <p className="mt-1 font-bold">
                    {c.client?.business_name || c.client?.name}
                </p>
                {c.client?.business_name && <p>{c.client.name}</p>}

                <Divider />
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-1.5 font-bold">
                    <span>Máq.</span>
                    <span className="text-right">In</span>
                    <span className="text-right">Out</span>
                    <span className="text-right">Neto</span>
                </div>
                {items.map((item) => (
                    <div key={item.id} className="mt-0.5">
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-1.5">
                            <span className="truncate">
                                {item.machine?.code}
                            </span>
                            <span className="text-right">
                                {num(item.current_in - item.previous_in)}
                            </span>
                            <span className="text-right">
                                {num(item.current_out - item.previous_out)}
                            </span>
                            <span className="text-right">
                                {money(item.net)}
                            </span>
                        </div>
                        {isCompany && (
                            <div className="pl-2 text-[0.9em]">
                                <p>
                                    Cont. {num(item.current_in)} /{' '}
                                    {num(item.current_out)}
                                </p>
                                {item.cash_counted !== null && (
                                    <p>
                                        Real {money(item.cash_counted)} · Dif.{' '}
                                        {money(
                                            Number(item.cash_counted) -
                                                Number(item.net),
                                        )}
                                    </p>
                                )}
                                {item.forced && <p>* Corte forzado</p>}
                                {item.notes && <p>Obs: {item.notes}</p>}
                            </div>
                        )}
                    </div>
                ))}

                <Divider />
                <Line label="Total máquinas" value={money(c.net)} strong />
                <Line
                    label={`Total cliente (${percent(c.commission_percent)})`}
                    value={money(c.client_share)}
                />
                {Number(c.loss_offset) > 0 && (
                    <Line
                        label="Rebaja pérdida"
                        value={`-${money(c.loss_offset)}`}
                    />
                )}
                {Number(c.loss_added) > 0 && (
                    <Line
                        label="Pérdida pendiente"
                        value={money(c.loss_added)}
                    />
                )}
                {Number(c.loan_deduction) > 0 && (
                    <Line
                        label="Abono préstamo"
                        value={`-${money(c.loan_deduction)}`}
                    />
                )}
                <Line
                    label="Entregado al cliente"
                    value={money(c.client_paid)}
                    strong
                />
                <Line label="Total empresa" value={money(c.company_share)} />
                {isCompany && (
                    <Line
                        label="Efectivo a oficina"
                        value={money(c.cash_delivered)}
                        strong
                    />
                )}
                {loansBalance > 0 && (
                    <>
                        <Divider />
                        <Line
                            label="Saldo préstamos"
                            value={money(loansBalance)}
                            strong
                        />
                    </>
                )}

                <Divider />
                <div className="mt-2 text-center">
                    {c.signature_path ? (
                        <img
                            src={collections.signature(c.id).url}
                            alt="Firma del tendero"
                            className="mx-auto h-16 object-contain"
                        />
                    ) : (
                        <div className="h-10" />
                    )}
                    <p className="mx-4 border-t border-black pt-0.5">
                        Firma del cliente
                    </p>
                </div>

                <p className="mt-3 text-center font-bold uppercase">
                    Copia {copy}
                </p>
            </article>
        </div>
    );
}

function Divider() {
    return <hr className="my-1.5 border-t border-dashed border-black" />;
}

function Line({
    label,
    value,
    strong,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className={cn('flex justify-between gap-2', strong && 'font-bold')}
        >
            <span>{label}</span>
            <span className="text-right whitespace-nowrap">{value}</span>
        </div>
    );
}

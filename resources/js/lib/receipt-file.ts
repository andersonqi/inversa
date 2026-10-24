import { date, gtq as money, num, percent } from '@/lib/format';
import type { Collection } from '@/types';

/**
 * Ticket del corte como imagen (PNG) o PDF, generado en el navegador para compartirlo
 * por WhatsApp. Siempre es la copia del cliente y en quetzales.
 */

export type PaperWidth = 58 | 80;

export function receiptNumber(id: number): string {
    return String(id).padStart(6, '0');
}

export function receiptTime(value: string): string {
    return new Date(value).toLocaleTimeString('es-GT', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Recibo en texto plano para compartir por WhatsApp. */
export function receiptText(
    company: string,
    c: Collection,
    loansBalance: number,
): string {
    const lines = [
        `*${company}*`,
        `Recibo de corte #${receiptNumber(c.id)}`,
        `Fecha: ${date(c.collected_on)} ${receiptTime(c.created_at)}`,
        `Tienda: ${c.client?.business_name || c.client?.name}`,
        '',
        '*Máquinas*',
        ...(c.items ?? []).map(
            (item) =>
                `• ${item.machine?.code}: In ${num(item.current_in - item.previous_in)} / Out ${num(item.current_out - item.previous_out)} / Neto ${money(item.net)}`,
        ),
        '',
        `Total máquinas: ${money(c.net)}`,
        `Total cliente (${percent(c.commission_percent)}): ${money(c.client_share)}`,
    ];

    if (Number(c.loss_offset) > 0) {
        lines.push(`Rebaja pérdida pendiente: -${money(c.loss_offset)}`);
    }

    if (Number(c.loan_deduction) > 0) {
        lines.push(`Abono a préstamo: -${money(c.loan_deduction)}`);
    }

    lines.push(
        `*Efectivo entregado al cliente: ${money(c.client_paid)}*`,
        `Total empresa: ${money(c.company_share)}`,
    );

    if (loansBalance > 0) {
        lines.push(`Saldo pendiente de préstamos: ${money(loansBalance)}`);
    }

    return lines.join('\n');
}

/** Mensaje corto que acompaña al archivo. */
export function receiptCaption(company: string, c: Collection): string {
    return `${company} · Recibo de corte #${receiptNumber(c.id)} · ${c.client?.business_name || c.client?.name} · ${date(c.collected_on)} · Entregado al cliente: ${money(c.client_paid)}`;
}

type Line =
    | { kind: 'center'; text: string; bold?: boolean; scale?: number }
    | { kind: 'pair'; left: string; right: string; bold?: boolean }
    | { kind: 'columns'; cells: [string, string, string, string]; bold?: boolean }
    | { kind: 'divider' }
    | { kind: 'signature'; image: HTMLImageElement | null }
    | { kind: 'logo'; image: HTMLImageElement }
    | { kind: 'space'; height: number };

function buildLines(
    company: string,
    c: Collection,
    loansBalance: number,
    signature: HTMLImageElement | null,
    logo: HTMLImageElement | null,
): Line[] {
    const lines: Line[] = [
        ...(logo ? [{ kind: 'logo', image: logo } as const] : []),
        { kind: 'center', text: company.toUpperCase(), bold: true, scale: 1.3 },
        { kind: 'center', text: 'Recibo de corte' },
        { kind: 'center', text: `#${receiptNumber(c.id)}`, bold: true },
        { kind: 'divider' },
        { kind: 'pair', left: 'Fecha', right: date(c.collected_on) },
        { kind: 'pair', left: 'Hora', right: receiptTime(c.created_at) },
        { kind: 'pair', left: 'Ruta', right: c.collection_route?.code ?? '' },
        { kind: 'pair', left: 'Cobrador', right: c.user?.name ?? '' },
        {
            kind: 'center',
            text: c.client?.business_name || c.client?.name || '',
            bold: true,
        },
    ];

    if (c.client?.business_name && c.client.name) {
        lines.push({ kind: 'center', text: c.client.name });
    }

    lines.push(
        { kind: 'divider' },
        { kind: 'columns', cells: ['Máq.', 'In', 'Out', 'Neto'], bold: true },
        ...(c.items ?? []).map(
            (item): Line => ({
                kind: 'columns',
                cells: [
                    item.machine?.code ?? '',
                    num(item.current_in - item.previous_in),
                    num(item.current_out - item.previous_out),
                    money(item.net),
                ],
            }),
        ),
        { kind: 'divider' },
        { kind: 'pair', left: 'Total máquinas', right: money(c.net), bold: true },
        {
            kind: 'pair',
            left: `Total cliente (${percent(c.commission_percent)})`,
            right: money(c.client_share),
        },
    );

    if (Number(c.loss_offset) > 0) {
        lines.push({
            kind: 'pair',
            left: 'Rebaja pérdida',
            right: `-${money(c.loss_offset)}`,
        });
    }

    if (Number(c.loss_added) > 0) {
        lines.push({
            kind: 'pair',
            left: 'Pérdida pendiente',
            right: money(c.loss_added),
        });
    }

    if (Number(c.loan_deduction) > 0) {
        lines.push({
            kind: 'pair',
            left: 'Abono préstamo',
            right: `-${money(c.loan_deduction)}`,
        });
    }

    lines.push(
        {
            kind: 'pair',
            left: 'Entregado al cliente',
            right: money(c.client_paid),
            bold: true,
        },
        { kind: 'pair', left: 'Total empresa', right: money(c.company_share) },
    );

    if (loansBalance > 0) {
        lines.push(
            { kind: 'divider' },
            {
                kind: 'pair',
                left: 'Saldo préstamos',
                right: money(loansBalance),
                bold: true,
            },
        );
    }

    lines.push(
        { kind: 'divider' },
        { kind: 'signature', image: signature },
        { kind: 'center', text: 'Firma del cliente' },
        { kind: 'space', height: 0.6 },
        { kind: 'center', text: 'COPIA CLIENTE', bold: true },
    );

    return lines;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
    });
}

const FONT_FAMILY = 'ui-monospace, Menlo, Consolas, "Courier New", monospace';

/** Recorta el texto con "…" para que quepa en el ancho indicado. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
    if (ctx.measureText(text).width <= max) {
        return text;
    }

    let cut = text;

    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) {
        cut = cut.slice(0, -1);
    }

    return `${cut}…`;
}

/** Parte un texto en renglones que quepan en el ancho indicado. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
    const words = text.split(' ');
    const rows: string[] = [];
    let row = '';

    for (const word of words) {
        const next = row ? `${row} ${word}` : word;

        if (ctx.measureText(next).width <= max || !row) {
            row = next;
        } else {
            rows.push(row);
            row = word;
        }
    }

    if (row) {
        rows.push(row);
    }

    return rows.map((r) => fit(ctx, r, max));
}

/**
 * Dibuja el ticket en un canvas con el ancho del papel térmico (a 2× para que se lea
 * nítido en el teléfono).
 */
async function renderCanvas(
    company: string,
    c: Collection,
    loansBalance: number,
    paper: PaperWidth,
    signatureUrl: string | null,
    logoUrl: string | null,
): Promise<HTMLCanvasElement> {
    const scale = 2;
    // 58 mm ≈ 384 px y 80 mm ≈ 576 px en impresoras térmicas de 203 ppp.
    const cssWidth = paper === 58 ? 384 : 576;
    const width = cssWidth * scale;
    const padding = 18 * scale;
    const fontSize = (paper === 58 ? 17 : 20) * scale;
    const lineHeight = Math.round(fontSize * 1.45);
    const inner = width - padding * 2;

    const [signature, logo] = await Promise.all([
        signatureUrl ? loadImage(signatureUrl) : Promise.resolve(null),
        logoUrl ? loadImage(logoUrl) : Promise.resolve(null),
    ]);
    const lines = buildLines(company, c, loansBalance, signature, logo);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    const measure = canvas.getContext('2d');

    if (!measure) {
        throw new Error('El navegador no permite generar imágenes.');
    }

    const font = (bold?: boolean, size = 1) =>
        `${bold ? 'bold ' : ''}${Math.round(fontSize * size)}px ${FONT_FAMILY}`;

    // Anchos de las columnas numéricas (In, Out, Neto) según el texto más largo.
    const columnRows = lines.filter(
        (l): l is Extract<Line, { kind: 'columns' }> => l.kind === 'columns',
    );
    const gap = 10 * scale;
    const colWidths = [1, 2, 3].map((i) =>
        Math.max(
            ...columnRows.map((row) => {
                measure.font = font(row.bold);

                return measure.measureText(row.cells[i]).width;
            }),
            0,
        ),
    );

    // Primera pasada: calcular renglones y alto total.
    type Op = { line: Line; y: number; rows?: string[] };
    const ops: Op[] = [];
    let y = padding;

    for (const line of lines) {
        if (line.kind === 'center') {
            measure.font = font(line.bold, line.scale);
            const rows = wrap(measure, line.text, inner);
            ops.push({ line, y, rows });
            y += rows.length * lineHeight * (line.scale ?? 1);
        } else if (line.kind === 'divider') {
            ops.push({ line, y });
            y += lineHeight * 0.7;
        } else if (line.kind === 'signature') {
            ops.push({ line, y });
            y += line.image ? lineHeight * 3.2 : lineHeight * 2.2;
        } else if (line.kind === 'logo') {
            ops.push({ line, y });
            y += lineHeight * 3.4;
        } else if (line.kind === 'space') {
            y += lineHeight * line.height;
        } else {
            ops.push({ line, y });
            y += lineHeight;
        }
    }

    canvas.height = Math.ceil(y + padding);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('El navegador no permite generar imágenes.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.textBaseline = 'top';

    const right = width - padding;

    for (const { line, y: top, rows } of ops) {
        switch (line.kind) {
            case 'center': {
                const size = line.scale ?? 1;
                ctx.font = font(line.bold, size);
                ctx.textAlign = 'center';
                (rows ?? []).forEach((row, i) =>
                    ctx.fillText(row, width / 2, top + i * lineHeight * size),
                );
                break;
            }
            case 'pair': {
                ctx.font = font(line.bold);
                ctx.textAlign = 'right';
                ctx.fillText(line.right, right, top);
                const rightWidth = ctx.measureText(line.right).width;
                ctx.textAlign = 'left';
                ctx.fillText(
                    fit(ctx, line.left, inner - rightWidth - gap),
                    padding,
                    top,
                );
                break;
            }
            case 'columns': {
                ctx.font = font(line.bold);
                ctx.textAlign = 'right';
                let edge = right;

                for (let i = 3; i >= 1; i--) {
                    ctx.fillText(line.cells[i], edge, top);
                    edge -= colWidths[i - 1] + gap;
                }

                ctx.textAlign = 'left';
                ctx.fillText(
                    fit(ctx, line.cells[0], edge - padding),
                    padding,
                    top,
                );
                break;
            }
            case 'divider': {
                ctx.setLineDash([6 * scale, 4 * scale]);
                ctx.lineWidth = scale;
                ctx.beginPath();
                ctx.moveTo(padding, top + lineHeight * 0.3);
                ctx.lineTo(right, top + lineHeight * 0.3);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            }
            case 'signature': {
                const area = line.image ? lineHeight * 2.6 : lineHeight * 1.6;

                if (line.image) {
                    const ratio = Math.min(
                        (inner * 0.8) / line.image.width,
                        area / line.image.height,
                    );
                    const w = line.image.width * ratio;
                    const h = line.image.height * ratio;
                    ctx.drawImage(line.image, (width - w) / 2, top, w, h);
                }

                ctx.lineWidth = scale;
                ctx.beginPath();
                ctx.moveTo(padding + inner * 0.1, top + area + lineHeight * 0.4);
                ctx.lineTo(right - inner * 0.1, top + area + lineHeight * 0.4);
                ctx.stroke();
                break;
            }
            case 'logo': {
                // Logo centrado en escala de grises (como saldrá en la impresora térmica).
                const area = lineHeight * 3;
                const ratio = Math.min(
                    (inner * 0.6) / line.image.width,
                    area / line.image.height,
                );
                const w = line.image.width * ratio;
                const h = line.image.height * ratio;
                ctx.save();
                ctx.filter = 'grayscale(1)';
                ctx.drawImage(line.image, (width - w) / 2, top, w, h);
                ctx.restore();
                break;
            }
            default:
                break;
        }
    }

    return canvas;
}

function canvasBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality?: number,
): Promise<Blob> {
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) =>
                blob ? resolve(blob) : reject(new Error('No se pudo generar.')),
            type,
            quality,
        ),
    );
}

/**
 * PDF de una página con la imagen JPEG del ticket, al ancho del papel. Se arma a mano
 * (formato PDF 1.4 mínimo) para no depender de librerías externas.
 */
export function jpegToPdf(
    jpeg: Uint8Array<ArrayBuffer>,
    pixelWidth: number,
    pixelHeight: number,
    pageWidthMm: number,
): Blob {
    const encoder = new TextEncoder();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    const offsets: number[] = [];
    let length = 0;

    const push = (data: string | Uint8Array<ArrayBuffer>) => {
        const bytes = typeof data === 'string' ? encoder.encode(data) : data;
        chunks.push(bytes);
        length += bytes.length;
    };
    const object = (id: number, ...body: (string | Uint8Array<ArrayBuffer>)[]) => {
        offsets[id] = length;
        push(`${id} 0 obj\n`);
        body.forEach(push);
        push('\nendobj\n');
    };

    const w = (pageWidthMm * 72) / 25.4;
    const h = (w * pixelHeight) / pixelWidth;
    const n = (value: number) => value.toFixed(2);
    const content = `q ${n(w)} 0 0 ${n(h)} 0 0 cm /Im0 Do Q`;

    push('%PDF-1.4\n');
    push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(
        3,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(w)} ${n(h)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    );
    object(
        4,
        `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
        jpeg,
        '\nendstream',
    );
    object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

    const xref = length;
    push(
        'xref\n0 6\n0000000000 65535 f \n' +
            offsets
                .slice(1)
                .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
                .join(''),
    );
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

    return new Blob(chunks, { type: 'application/pdf' });
}

/** Genera el ticket del corte como archivo PNG y PDF. */
export async function buildReceiptFiles(
    company: string,
    c: Collection,
    loansBalance: number,
    paper: PaperWidth,
    signatureUrl: string | null,
    logoUrl: string | null = null,
): Promise<{ image: File; pdf: File }> {
    const canvas = await renderCanvas(
        company,
        c,
        loansBalance,
        paper,
        signatureUrl,
        logoUrl,
    );
    const name = `recibo-${receiptNumber(c.id)}`;

    const png = await canvasBlob(canvas, 'image/png');
    const jpeg = new Uint8Array(
        await (await canvasBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer(),
    );

    return {
        image: new File([png], `${name}.png`, { type: 'image/png' }),
        pdf: new File(
            [jpegToPdf(jpeg, canvas.width, canvas.height, paper)],
            `${name}.pdf`,
            { type: 'application/pdf' },
        ),
    };
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

/**
 * Abre el menú "Compartir" del teléfono con el archivo adjunto (ahí se elige WhatsApp).
 * Si el navegador no permite compartir archivos devuelve "unsupported".
 */
export async function shareFile(file: File, text: string): Promise<ShareResult> {
    const data: ShareData = { files: [file], text, title: file.name };

    if (typeof navigator.canShare !== 'function' || !navigator.canShare(data)) {
        return 'unsupported';
    }

    try {
        await navigator.share(data);

        return 'shared';
    } catch (error) {
        return error instanceof DOMException && error.name === 'AbortError'
            ? 'cancelled'
            : 'unsupported';
    }
}

export function downloadFile(file: File): void {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

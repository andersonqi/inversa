/** Tema de color compartido por el servidor (App\Support\Branding::theme). */
export type BrandTheme = {
    color: string;
    contrast: string;
    company_color: string;
    logo_url: string | null;
};

/** Colores sugeridos para la interfaz. */
export const BRAND_PRESETS: { color: string; name: string }[] = [
    { color: '#0e5a4a', name: 'Esmeralda' },
    { color: '#0f766e', name: 'Turquesa' },
    { color: '#1d4ed8', name: 'Azul' },
    { color: '#4338ca', name: 'Índigo' },
    { color: '#7c3aed', name: 'Violeta' },
    { color: '#be185d', name: 'Fucsia' },
    { color: '#b91c1c', name: 'Rojo' },
    { color: '#c2410c', name: 'Naranja' },
    { color: '#a16207', name: 'Mostaza' },
    { color: '#334155', name: 'Grafito' },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Texto legible sobre el color (misma regla que el servidor). */
export function contrastFor(hex: string): string {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;

        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05
        ? '#ffffff'
        : '#111827';
}

/** Aplica el color a toda la interfaz (variables CSS de <html>). */
export function applyBrandColor(color: string | null | undefined): void {
    if (typeof document === 'undefined' || !color || !HEX.test(color)) {
        return;
    }

    const root = document.documentElement;
    root.style.setProperty('--brand', color);
    root.style.setProperty('--brand-contrast', contrastFor(color));
    document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', color);
}

import type { SVGAttributes } from 'react';

/**
 * Marca de Inversa: tres rodillos de tragamonedas que suben como barras de crecimiento.
 * La placa usa el color de latón; los rodillos, el verde paño.
 */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            {...props}
        >
            <rect width="32" height="32" rx="8" fill="var(--brass)" />
            <rect
                x="6.5"
                y="15"
                width="5"
                height="11"
                rx="1.75"
                fill="var(--felt-deep)"
            />
            <rect
                x="13.5"
                y="10.5"
                width="5"
                height="15.5"
                rx="1.75"
                fill="var(--felt-deep)"
            />
            <rect
                x="20.5"
                y="6"
                width="5"
                height="20"
                rx="1.75"
                fill="var(--felt-deep)"
            />
            <rect
                x="14.75"
                y="16.5"
                width="2.5"
                height="2.5"
                rx="1.25"
                fill="var(--brass)"
            />
        </svg>
    );
}

/** Días de la semana ISO (1 = lunes … 7 = domingo). */
export const WEEK_DAYS = [
    { value: 1, short: 'Lun', label: 'Lunes' },
    { value: 2, short: 'Mar', label: 'Martes' },
    { value: 3, short: 'Mié', label: 'Miércoles' },
    { value: 4, short: 'Jue', label: 'Jueves' },
    { value: 5, short: 'Vie', label: 'Viernes' },
    { value: 6, short: 'Sáb', label: 'Sábado' },
    { value: 7, short: 'Dom', label: 'Domingo' },
] as const;

export function dayLabel(day: number | null | undefined): string {
    return WEEK_DAYS.find((d) => d.value === day)?.label ?? 'Sin día';
}

export type Located = {
    latitude: string | null;
    longitude: string | null;
    address: string | null;
    city?: string | null;
    district?: string | null;
};

export function hasCoordinates(place: Located): boolean {
    return Boolean(place.latitude) && Boolean(place.longitude);
}

/** Dirección completa en texto: dirección, distrito / zona y ciudad. */
export function placeText(place: Located): string {
    return [place.address, place.district, place.city]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ');
}

/** Enlace a Google Maps por coordenada o, si no hay, por dirección. */
export function googleMapsUrl(place: Located): string | null {
    if (hasCoordinates(place)) {
        return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
    }

    const text = placeText(place);

    return text
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`
        : null;
}

/** Ruta "Cómo llegar" en Google Maps desde la ubicación actual del teléfono. */
export function googleDirectionsUrl(place: Located): string | null {
    if (hasCoordinates(place)) {
        return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=driving`;
    }

    const text = placeText(place);

    return text
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(text)}&travelmode=driving`
        : null;
}

/** Enlace de navegación en Waze por coordenada o, si no hay, por dirección. */
export function wazeUrl(place: Located): string | null {
    if (hasCoordinates(place)) {
        return `https://waze.com/ul?ll=${place.latitude},${place.longitude}&navigate=yes`;
    }

    const text = placeText(place);

    return text
        ? `https://waze.com/ul?q=${encodeURIComponent(text)}&navigate=yes`
        : null;
}

/**
 * Enlace de WhatsApp con texto prellenado. Los teléfonos locales de 8 dígitos
 * se completan con el código de Guatemala (502). Sin teléfono, WhatsApp deja
 * elegir el contacto.
 */
export function whatsappUrl(
    phone: string | null | undefined,
    text: string,
): string {
    let digits = (phone ?? '').replace(/\D/g, '');

    if (digits.length === 8) {
        digits = `502${digits}`;
    }

    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

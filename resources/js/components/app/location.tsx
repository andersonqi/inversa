import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import { useState } from 'react';
import { Field, FormGrid } from '@/components/app/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    getPrecisePosition,
    reverseGeocode,
    WEAK_ACCURACY,
} from '@/lib/geolocation';
import type { Located } from '@/lib/route-tools';
import {
    googleDirectionsUrl,
    hasCoordinates,
    wazeUrl,
} from '@/lib/route-tools';
import { cn } from '@/lib/utils';

/** Mapa de OpenStreetMap con un marcador en la coordenada (no requiere clave). */
export function LocationMap({
    latitude,
    longitude,
    className,
}: {
    latitude: string | number;
    longitude: string | number;
    className?: string;
}) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const delta = 0.003;
    const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(',');

    return (
        <iframe
            title="Mapa de la ubicación del negocio"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
            loading="lazy"
            className={cn('h-56 w-full rounded-lg border', className)}
        />
    );
}

/** Botones para llegar al negocio con el GPS del teléfono. */
export function LocationLinks({
    place,
    className,
}: {
    place: Located;
    className?: string;
}) {
    const directions = googleDirectionsUrl(place);
    const waze = wazeUrl(place);

    if (!directions && !waze) {
        return null;
    }

    return (
        <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
            {directions && (
                <Button variant="outline" asChild>
                    <a href={directions} target="_blank" rel="noreferrer">
                        <MapPin /> Cómo llegar (Google Maps)
                    </a>
                </Button>
            )}
            {waze && (
                <Button variant="outline" asChild>
                    <a href={waze} target="_blank" rel="noreferrer">
                        <Navigation /> Ir con Waze
                    </a>
                </Button>
            )}
        </div>
    );
}

type Status = {
    tone: 'info' | 'success' | 'warning' | 'error';
    text: string;
};

const TONES: Record<Status['tone'], string> = {
    info: 'text-muted-foreground',
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
};

type LocationValues = {
    address: string;
    city: string;
    district: string;
    latitude: string;
    longitude: string;
};

/**
 * Ubicación del cliente en el formulario: el botón toma la coordenada exacta con el GPS
 * del teléfono y llena dirección, distrito y ciudad; todo se puede corregir a mano.
 */
export function LocationFields({
    initial,
    errors,
}: {
    initial: Partial<Record<keyof LocationValues, string | null>>;
    errors: Partial<Record<keyof LocationValues, string>>;
}) {
    const [values, setValues] = useState<LocationValues>({
        address: initial.address ?? '',
        city: initial.city ?? '',
        district: initial.district ?? '',
        latitude: initial.latitude ?? '',
        longitude: initial.longitude ?? '',
    });
    const [status, setStatus] = useState<Status | null>(null);
    const [busy, setBusy] = useState(false);

    const set = (key: keyof LocationValues, value: string) =>
        setValues((current) => ({ ...current, [key]: value }));

    const place: Located = {
        latitude: values.latitude || null,
        longitude: values.longitude || null,
        address: values.address || null,
        city: values.city || null,
        district: values.district || null,
    };
    const located =
        hasCoordinates(place) &&
        Number.isFinite(Number(values.latitude)) &&
        Number.isFinite(Number(values.longitude));

    const locate = async () => {
        setBusy(true);
        setStatus({
            tone: 'info',
            text: 'Buscando la señal GPS… quédese en el negocio; afuera la señal es mejor.',
        });

        try {
            const reading = await getPrecisePosition();
            const meters = Math.round(reading.accuracy);

            setValues((current) => ({
                ...current,
                latitude: reading.latitude.toFixed(7),
                longitude: reading.longitude.toFixed(7),
            }));
            setStatus({
                tone: 'info',
                text: `Ubicación tomada (margen ±${meters} m). Buscando la dirección…`,
            });

            const details = await reverseGeocode(
                reading.latitude,
                reading.longitude,
            );

            if (details) {
                setValues((current) => ({
                    ...current,
                    address: details.address ?? current.address,
                    city: details.city ?? current.city,
                    district: details.district ?? current.district,
                }));
            }

            if (reading.accuracy > WEAK_ACCURACY) {
                setStatus({
                    tone: 'warning',
                    text: `La señal es débil (margen ±${meters} m). Si puede, salga a la calle frente al negocio y vuelva a tomar la ubicación.`,
                });
            } else if (details) {
                setStatus({
                    tone: 'success',
                    text: `Ubicación lista (margen ±${meters} m). Revise la dirección y corríjala si hace falta.`,
                });
            } else {
                setStatus({
                    tone: 'warning',
                    text: 'Se tomó la coordenada, pero no se encontró la dirección: escríbala a mano.',
                });
            }
        } catch (error) {
            setStatus({
                tone: 'error',
                text:
                    error instanceof Error
                        ? error.message
                        : 'No se pudo obtener la ubicación.',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Ubicación</legend>
            <div className="space-y-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void locate()}
                >
                    <LocateFixed />
                    {busy
                        ? 'Obteniendo ubicación…'
                        : located
                          ? 'Volver a tomar la ubicación GPS'
                          : 'Tomar ubicación GPS de este teléfono'}
                </Button>
                {status ? (
                    <p className={cn('text-sm', TONES[status.tone])}>
                        {status.text}
                    </p>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        Párese en el negocio y toque el botón: se guarda la
                        coordenada exacta y se llenan la dirección, el distrito
                        y la ciudad.
                    </p>
                )}
            </div>
            <FormGrid>
                <Field
                    label="Dirección"
                    htmlFor="address"
                    error={errors.address}
                    className="sm:col-span-2"
                >
                    <Input
                        id="address"
                        name="address"
                        value={values.address}
                        onChange={(e) => set('address', e.target.value)}
                        maxLength={255}
                    />
                </Field>
                <Field
                    label="Distrito / zona"
                    htmlFor="district"
                    error={errors.district}
                    hint="Zona, colonia, barrio o aldea."
                >
                    <Input
                        id="district"
                        name="district"
                        value={values.district}
                        onChange={(e) => set('district', e.target.value)}
                        maxLength={120}
                    />
                </Field>
                <Field
                    label="Ciudad / municipio"
                    htmlFor="city"
                    error={errors.city}
                >
                    <Input
                        id="city"
                        name="city"
                        value={values.city}
                        onChange={(e) => set('city', e.target.value)}
                        maxLength={120}
                    />
                </Field>
                <Field
                    label="Latitud"
                    htmlFor="latitude"
                    error={errors.latitude}
                    hint="Se llena con el botón GPS."
                >
                    <Input
                        id="latitude"
                        name="latitude"
                        type="number"
                        step="0.0000001"
                        min={-90}
                        max={90}
                        value={values.latitude}
                        onChange={(e) => set('latitude', e.target.value)}
                    />
                </Field>
                <Field
                    label="Longitud"
                    htmlFor="longitude"
                    error={errors.longitude}
                >
                    <Input
                        id="longitude"
                        name="longitude"
                        type="number"
                        step="0.0000001"
                        min={-180}
                        max={180}
                        value={values.longitude}
                        onChange={(e) => set('longitude', e.target.value)}
                    />
                </Field>
            </FormGrid>
            {located && (
                <div className="space-y-3">
                    <LocationMap
                        latitude={values.latitude}
                        longitude={values.longitude}
                    />
                    <LocationLinks place={place} />
                </div>
            )}
        </fieldset>
    );
}

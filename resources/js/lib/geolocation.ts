import geocoding from '@/routes/geocoding';

export type GpsReading = {
    latitude: number;
    longitude: number;
    /** Margen de error en metros. */
    accuracy: number;
};

export type PlaceDetails = {
    address: string | null;
    city: string | null;
    district: string | null;
};

type ReverseResponse = PlaceDetails & { found: boolean };

/** Precisión con la que se deja de esperar (metros). */
const GOOD_ACCURACY = 20;

/** Tiempo máximo esperando una mejor lectura (ms). */
const MAX_WAIT = 15_000;

/** Por encima de este margen se recomienda volver a intentar. */
export const WEAK_ACCURACY = 50;

/**
 * Ubicación GPS del teléfono lo más exacta posible: escucha las lecturas durante unos
 * segundos y se queda con la de menor margen de error (el primer dato del GPS suele ser
 * aproximado).
 */
export function getPrecisePosition(): Promise<GpsReading> {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject(
                new Error('Este dispositivo no permite obtener la ubicación.'),
            );

            return;
        }

        let best: GpsReading | null = null;
        let done = false;
        let timer = 0;
        let watchId = 0;

        const stop = () => {
            done = true;
            navigator.geolocation.clearWatch(watchId);
            window.clearTimeout(timer);
        };

        const finish = () => {
            if (done) {
                return;
            }

            stop();

            if (best) {
                resolve(best);
            } else {
                reject(
                    new Error(
                        'No se pudo obtener la ubicación. Revise que el GPS esté encendido y que el permiso de ubicación esté activo.',
                    ),
                );
            }
        };

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const reading: GpsReading = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                };

                if (!best || reading.accuracy < best.accuracy) {
                    best = reading;
                }

                if (reading.accuracy <= GOOD_ACCURACY) {
                    finish();
                }
            },
            (error) => {
                if (done || error.code !== error.PERMISSION_DENIED) {
                    // Sin señal momentánea: se sigue esperando hasta el límite.
                    return;
                }

                stop();
                reject(
                    new Error(
                        'El permiso de ubicación está bloqueado. Actívelo en la configuración del navegador o del teléfono.',
                    ),
                );
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT },
        );

        timer = window.setTimeout(finish, MAX_WAIT);
    });
}

/** Dirección, ciudad y distrito de una coordenada (null si no se encontró). */
export async function reverseGeocode(
    latitude: number,
    longitude: number,
): Promise<PlaceDetails | null> {
    try {
        const response = await fetch(
            geocoding.reverse({
                query: {
                    latitude: latitude.toFixed(7),
                    longitude: longitude.toFixed(7),
                },
            }).url,
            {
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            },
        );

        if (!response.ok) {
            return null;
        }

        const { found, ...place } = (await response.json()) as ReverseResponse;

        return found ? place : null;
    } catch {
        return null;
    }
}

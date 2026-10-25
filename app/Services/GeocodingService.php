<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dirección a partir de una coordenada GPS (geocodificación inversa) con Nominatim de
 * OpenStreetMap: sin costo ni clave. Las respuestas se guardan en caché para respetar
 * su política de uso (pocas consultas, identificadas).
 *
 * @phpstan-type Place array{address: string|null, city: string|null, district: string|null}
 */
class GeocodingService
{
    private const CACHE_DAYS = 30;

    /**
     * @return Place|null null si el servicio no responde o no reconoce el lugar.
     */
    public function reverse(float $latitude, float $longitude): ?array
    {
        $key = sprintf('geocoding:reverse:%.5f,%.5f', $latitude, $longitude);

        /** @var Place|null $cached */
        $cached = Cache::get($key);

        if ($cached !== null) {
            return $cached;
        }

        $email = config('services.geocoding.email');

        try {
            $response = Http::timeout(8)
                ->acceptJson()
                ->withHeaders([
                    // Nominatim exige identificar la aplicación.
                    'User-Agent' => (string) config('app.name').' ('.(string) config('app.url').')',
                    'Accept-Language' => 'es',
                ])
                ->get(rtrim((string) config('services.geocoding.url'), '/').'/reverse', array_filter([
                    'format' => 'jsonv2',
                    'lat' => round($latitude, 7),
                    'lon' => round($longitude, 7),
                    'zoom' => 18,
                    'addressdetails' => 1,
                    'email' => is_string($email) && $email !== '' ? $email : null,
                ]));
        } catch (Throwable $e) {
            Log::info('Geocodificación no respondió: '.$e->getMessage());

            return null;
        }

        $address = $response->successful() ? $response->json('address') : null;

        if (! is_array($address)) {
            return null;
        }

        $displayName = $response->json('display_name');
        $place = self::fromNominatim($address, is_string($displayName) ? $displayName : null);

        Cache::put($key, $place, now()->addDays(self::CACHE_DAYS));

        return $place;
    }

    /**
     * Arma dirección, ciudad y distrito con los datos de Nominatim (en Guatemala la zona
     * suele venir como "suburb" o "city_district").
     *
     * @param  array<mixed>  $parts
     * @return Place
     */
    public static function fromNominatim(array $parts, ?string $displayName): array
    {
        $road = self::first($parts, ['road', 'pedestrian', 'footway', 'residential', 'path']);
        $number = self::first($parts, ['house_number']);
        $street = $road !== null ? trim($road.' '.($number ?? '')) : null;

        $district = self::first($parts, ['city_district', 'suburb', 'quarter', 'neighbourhood', 'hamlet']);
        $city = self::first($parts, ['city', 'town', 'village', 'municipality', 'county']);
        $neighbourhood = self::first($parts, ['neighbourhood', 'quarter']);

        $lines = array_values(array_unique(array_filter(
            [$street, $neighbourhood !== $district ? $neighbourhood : null],
            fn (?string $line) => $line !== null && $line !== '',
        )));

        // Sin calle conocida: las primeras partes del nombre completo del lugar.
        if ($lines === [] && $displayName !== null) {
            $lines = array_slice(array_map('trim', explode(',', $displayName)), 0, 2);
        }

        $address = implode(', ', $lines);

        return [
            'address' => $address !== '' ? mb_substr($address, 0, 255) : null,
            'city' => $city !== null ? mb_substr($city, 0, 120) : null,
            'district' => $district !== null ? mb_substr($district, 0, 120) : null,
        ];
    }

    /**
     * @param  array<mixed>  $parts
     * @param  list<string>  $keys
     */
    private static function first(array $parts, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = $parts[$key] ?? null;

            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return null;
    }
}

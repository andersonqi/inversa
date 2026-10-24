<?php

namespace App\Services;

use App\Models\ExchangeRate;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Tipo de cambio quetzal / dólar.
 *
 * Fuente principal: tipo de cambio de referencia del Banco de Guatemala (servicio web
 * oficial TipoCambioDia). Respaldo si Banguat no responde: ExchangeRate-API.
 * Los montos del sistema se guardan siempre en quetzales; el tipo de cambio solo se usa
 * para mostrarlos en dólares.
 *
 * @phpstan-type Payload array{rate: float, date: string, source: string, fetched_at: string}
 */
class ExchangeRateService
{
    public const CACHE_KEY = 'exchange-rate:current';

    public const BANGUAT_SOURCE = 'Banco de Guatemala (Banguat)';

    public const FALLBACK_SOURCE = 'ExchangeRate-API (respaldo)';

    private const BANGUAT_URL = 'https://www.banguat.gob.gt/variables/ws/TipoCambio.asmx';

    private const BANGUAT_ACTION = 'http://www.banguat.gob.gt/variables/ws/TipoCambioDia';

    private const FALLBACK_URL = 'https://open.er-api.com/v6/latest/USD';

    /**
     * Último tipo de cambio guardado (en caché unos minutos para no consultar en cada página).
     *
     * @return Payload|null
     */
    public function current(): ?array
    {
        /** @var Payload|null */
        return Cache::remember(self::CACHE_KEY, 600, fn () => ExchangeRate::query()
            ->where('currency', 'USD')
            ->latest('fetched_at')
            ->latest('id')
            ->first()
            ?->toPayload());
    }

    /**
     * Consulta las fuentes y guarda el tipo de cambio del día.
     *
     * @throws RuntimeException si ninguna fuente responde.
     */
    public function refresh(): ExchangeRate
    {
        $fetched = $this->fromBanguat() ?? $this->fromFallback();

        if ($fetched === null) {
            throw new RuntimeException('No se pudo consultar el tipo de cambio en Banguat ni en la fuente de respaldo.');
        }

        $rate = ExchangeRate::updateOrCreate(
            ['currency' => 'USD', 'rate_date' => $fetched['date'], 'source' => $fetched['source']],
            ['rate' => $fetched['rate'], 'fetched_at' => now()],
        );

        Cache::forget(self::CACHE_KEY);

        return $rate;
    }

    public function isStale(): bool
    {
        $current = $this->current();
        $maxAge = (int) config('services.exchange_rate.max_age_minutes', 60);

        return $current === null
            || Carbon::parse($current['fetched_at'])->lt(now()->subMinutes($maxAge));
    }

    /**
     * Actualiza si el dato tiene más de una hora; como mucho un intento cada 10 minutos.
     */
    public function refreshIfStale(): void
    {
        if (! $this->isStale() || ! Cache::add('exchange-rate:attempt', true, 600)) {
            return;
        }

        try {
            $this->refresh();
        } catch (Throwable $e) {
            Log::warning('Tipo de cambio: '.$e->getMessage());
        }
    }

    /**
     * @return array{rate: float, date: string, source: string}|null
     */
    private function fromBanguat(): ?array
    {
        $envelope = '<?xml version="1.0" encoding="utf-8"?>'
            .'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
            .'<soap:Body><TipoCambioDia xmlns="http://www.banguat.gob.gt/variables/ws/" /></soap:Body>'
            .'</soap:Envelope>';

        try {
            $response = Http::timeout(10)
                ->withHeaders(['SOAPAction' => '"'.self::BANGUAT_ACTION.'"'])
                ->withBody($envelope, 'text/xml; charset=utf-8')
                ->post(self::BANGUAT_URL);
        } catch (Throwable $e) {
            Log::info('Banguat no respondió: '.$e->getMessage());

            return null;
        }

        $body = $response->successful() ? $response->body() : '';

        if (! preg_match('/<referencia>\s*([0-9]+(?:\.[0-9]+)?)\s*<\/referencia>/i', $body, $rate)) {
            return null;
        }

        $value = (float) $rate[1];

        if (! self::plausible($value)) {
            return null;
        }

        $date = preg_match('/<fecha>\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*<\/fecha>/i', $body, $d)
            ? sprintf('%04d-%02d-%02d', $d[3], $d[2], $d[1])
            : now()->toDateString();

        return ['rate' => $value, 'date' => $date, 'source' => self::BANGUAT_SOURCE];
    }

    /**
     * @return array{rate: float, date: string, source: string}|null
     */
    private function fromFallback(): ?array
    {
        try {
            $response = Http::timeout(10)->acceptJson()->get(self::FALLBACK_URL);
        } catch (Throwable $e) {
            Log::info('Fuente de respaldo de tipo de cambio no respondió: '.$e->getMessage());

            return null;
        }

        $value = $response->successful() ? $response->json('rates.GTQ') : null;

        if (! is_numeric($value) || ! self::plausible((float) $value)) {
            return null;
        }

        $timestamp = $response->json('time_last_update_unix');

        return [
            'rate' => (float) $value,
            'date' => is_numeric($timestamp) ? Carbon::createFromTimestamp((int) $timestamp)->toDateString() : now()->toDateString(),
            'source' => self::FALLBACK_SOURCE,
        ];
    }

    /**
     * Descarta respuestas absurdas (el quetzal ronda los 7–8 por dólar).
     */
    private static function plausible(float $rate): bool
    {
        return $rate >= 4 && $rate <= 20;
    }
}

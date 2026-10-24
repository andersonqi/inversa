<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Días que se conservan las fotos de los contadores tomadas en los cortes. Pasado ese
 * plazo (contado desde la fecha del corte) se eliminan para no llenar el servidor; el
 * corte, sus lecturas y la firma se conservan.
 */
final class PhotoRetention
{
    public const KEY = 'photo_retention';

    public const DEFAULT_DAYS = 90;

    public const MIN_DAYS = 7;

    public const MAX_DAYS = 1825;

    /**
     * Plazos sugeridos para elegir rápido en la pantalla.
     */
    public const PRESETS = [30, 60, 90, 180, 365];

    public function __construct(public readonly int $days) {}

    public static function current(): self
    {
        $value = Setting::read(self::KEY, []);
        $days = is_array($value) && is_numeric($value['days'] ?? null) ? (int) $value['days'] : self::DEFAULT_DAYS;

        return new self(max(self::MIN_DAYS, min(self::MAX_DAYS, $days)));
    }

    public static function save(int $days): self
    {
        Setting::write(self::KEY, ['days' => $days]);

        return self::current();
    }

    /**
     * @return array{days: int, presets: list<int>, min: int, max: int}
     */
    public function toArray(): array
    {
        return [
            'days' => $this->days,
            'presets' => self::PRESETS,
            'min' => self::MIN_DAYS,
            'max' => self::MAX_DAYS,
        ];
    }
}

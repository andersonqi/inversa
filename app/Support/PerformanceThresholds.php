<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Montos para clasificar el rendimiento de las máquinas según su ganancia neta promedio
 * por semana (en quetzales):
 *
 * - Excelente: igual o mayor al monto de "excelente".
 * - Insuficiente: menor al monto de "insuficiente".
 * - Bueno: entre ambos.
 */
final class PerformanceThresholds
{
    public const KEY = 'performance_thresholds';

    public const DEFAULT_EXCELLENT = 1000.0;

    public const DEFAULT_POOR = 300.0;

    /**
     * Montos sugeridos para elegir rápido en la pantalla.
     */
    public const EXCELLENT_PRESETS = [500, 750, 1000, 1500, 2000, 3000];

    public const POOR_PRESETS = [100, 200, 300, 400, 500];

    public function __construct(
        public readonly float $excellent,
        public readonly float $poor,
    ) {}

    public static function current(): self
    {
        $value = Setting::read(self::KEY, []);
        $value = is_array($value) ? $value : [];

        return new self(
            is_numeric($value['excellent'] ?? null) ? (float) $value['excellent'] : self::DEFAULT_EXCELLENT,
            is_numeric($value['poor'] ?? null) ? (float) $value['poor'] : self::DEFAULT_POOR,
        );
    }

    public static function save(float $excellent, float $poor): self
    {
        Setting::write(self::KEY, ['excellent' => round($excellent, 2), 'poor' => round($poor, 2)]);

        return self::current();
    }

    /**
     * @return 'excellent'|'good'|'poor'
     */
    public function classify(float $weeklyNet): string
    {
        if ($weeklyNet >= $this->excellent) {
            return 'excellent';
        }

        return $weeklyNet < $this->poor ? 'poor' : 'good';
    }

    /**
     * @return array{excellent: float, poor: float, excellent_presets: list<int>, poor_presets: list<int>}
     */
    public function toArray(): array
    {
        return [
            'excellent' => $this->excellent,
            'poor' => $this->poor,
            'excellent_presets' => self::EXCELLENT_PRESETS,
            'poor_presets' => self::POOR_PRESETS,
        ];
    }
}

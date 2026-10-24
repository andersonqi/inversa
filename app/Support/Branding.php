<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\User;

/**
 * Identidad visual: color de la empresa, logo subido por el administrador y color
 * personal de cada usuario.
 */
final class Branding
{
    public const KEY = 'branding';

    /**
     * Verde paño de la identidad original de Inversa.
     */
    public const DEFAULT_COLOR = '#0e5a4a';

    /**
     * Disco privado donde se guarda el logo (se sirve con una ruta pública).
     */
    public const DISK = 'local';

    public static function isHex(mixed $value): bool
    {
        return is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) === 1;
    }

    /**
     * Valores guardados: color, logo_path y logo_version.
     *
     * @return array<string, mixed>
     */
    public static function settings(): array
    {
        $value = Setting::read(self::KEY, []);

        /** @var array<string, mixed> */
        return is_array($value) ? $value : [];
    }

    public static function companyColor(): string
    {
        $color = self::settings()['color'] ?? null;

        return self::isHex($color) ? strtolower((string) $color) : self::DEFAULT_COLOR;
    }

    public static function logoPath(): ?string
    {
        $path = self::settings()['logo_path'] ?? null;

        return is_string($path) && $path !== '' ? $path : null;
    }

    public static function logoUrl(): ?string
    {
        if (self::logoPath() === null) {
            return null;
        }

        // La versión cambia con cada logo nuevo para que el navegador no use el anterior.
        $version = self::settings()['logo_version'] ?? 1;

        return route('branding.logo', ['v' => is_numeric($version) ? (int) $version : 1], false);
    }

    /**
     * Texto legible sobre el color: blanco o casi negro según su luminosidad (WCAG).
     */
    public static function contrast(string $hex): string
    {
        $channels = array_map(function (string $pair): float {
            $c = hexdec($pair) / 255;

            return $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
        }, str_split(ltrim($hex, '#'), 2));

        $luminance = 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];

        return (1.05 / ($luminance + 0.05)) >= (($luminance + 0.05) / 0.05) ? '#ffffff' : '#111827';
    }

    /**
     * Tema que se aplica a la interfaz del usuario (o de la pantalla de ingreso).
     *
     * @return array{color: string, contrast: string, company_color: string, logo_url: string|null}
     */
    public static function theme(?User $user): array
    {
        $company = self::companyColor();
        $color = self::isHex($user?->accent_color) ? strtolower((string) $user?->accent_color) : $company;

        return [
            'color' => $color,
            'contrast' => self::contrast($color),
            'company_color' => $company,
            'logo_url' => self::logoUrl(),
        ];
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    public static function save(array $changes): void
    {
        Setting::write(self::KEY, [...self::settings(), ...$changes]);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Parámetro general del sistema (clave → valor JSON).
 *
 * @property int $id
 * @property string $key
 * @property mixed $value
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['key', 'value'])]
class Setting extends Model
{
    private const CACHE_PREFIX = 'settings:';

    /**
     * Valor guardado (en caché hasta que se modifique) o el valor por defecto.
     */
    public static function read(string $key, mixed $default = null): mixed
    {
        /** @var array{value: string|null} $cached */
        $cached = Cache::rememberForever(
            self::CACHE_PREFIX.$key,
            fn () => ['value' => self::query()->toBase()->where('key', $key)->value('value')],
        );

        return $cached['value'] === null ? $default : json_decode($cached['value'], true);
    }

    public static function write(string $key, mixed $value): void
    {
        self::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget(self::CACHE_PREFIX.$key);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'json',
        ];
    }
}

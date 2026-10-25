<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Clave de ingreso sencilla: un PIN de exactamente 4 dígitos o una contraseña de al
 * menos 6 caracteres. No exige mayúsculas, números ni símbolos.
 */
class PasswordOrPin implements ValidationRule
{
    public const PIN_LENGTH = 4;

    public const MIN_LENGTH = 6;

    /**
     * Límite de bcrypt: lo que pase de 72 bytes no se toma en cuenta.
     */
    public const MAX_BYTES = 72;

    public const MESSAGE = 'Use un PIN de 4 dígitos o una contraseña de al menos 6 caracteres.';

    public static function isPin(string $value): bool
    {
        return preg_match('/^\d{'.self::PIN_LENGTH.'}$/', $value) === 1;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(self::MESSAGE);

            return;
        }

        if (strlen($value) > self::MAX_BYTES) {
            $fail('La contraseña no puede tener más de '.self::MAX_BYTES.' caracteres.');

            return;
        }

        if (! self::isPin($value) && mb_strlen($value) < self::MIN_LENGTH) {
            $fail(self::MESSAGE);
        }
    }
}

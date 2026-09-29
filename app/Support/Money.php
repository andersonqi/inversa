<?php

namespace App\Support;

class Money
{
    /**
     * Símbolo de la moneda de operación: colones.
     */
    public const SYMBOL = '₡';

    /**
     * Formatea un monto como ₡1.234,56 (igual que el frontend).
     */
    public static function format(float|string $amount): string
    {
        $value = (float) $amount;

        return ($value < 0 ? '-' : '').self::SYMBOL.number_format(abs($value), 2, ',', '.');
    }
}

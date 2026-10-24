<?php

namespace App\Support;

class Money
{
    /**
     * Símbolo de la moneda de operación: quetzales. Los montos se guardan siempre en Q.
     */
    public const SYMBOL = 'Q';

    /**
     * Formatea un monto como Q1,234.56 (igual que el frontend).
     */
    public static function format(float|string $amount): string
    {
        $value = (float) $amount;

        return ($value < 0 ? '-' : '').self::SYMBOL.number_format(abs($value), 2, '.', ',');
    }
}

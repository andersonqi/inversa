<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum ExpenseCategory: string
{
    use HasOptions;

    case Fuel = 'fuel';
    case Maintenance = 'maintenance';
    case Parts = 'parts';
    case Salaries = 'salaries';
    case Rent = 'rent';
    case Services = 'services';
    case Transport = 'transport';
    case Food = 'food';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Fuel => 'Combustible',
            self::Maintenance => 'Mantenimiento de máquinas',
            self::Parts => 'Repuestos',
            self::Salaries => 'Salarios',
            self::Rent => 'Alquiler',
            self::Services => 'Servicios',
            self::Transport => 'Transporte',
            self::Food => 'Alimentación',
            self::Other => 'Otros',
        };
    }
}

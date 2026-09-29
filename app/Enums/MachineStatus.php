<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum MachineStatus: string
{
    use HasOptions;

    case Warehouse = 'warehouse';
    case Installed = 'installed';
    case Maintenance = 'maintenance';
    case Retired = 'retired';

    public function label(): string
    {
        return match ($this) {
            self::Warehouse => 'En bodega',
            self::Installed => 'Instalada',
            self::Maintenance => 'En mantenimiento',
            self::Retired => 'Dada de baja',
        };
    }
}

<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum MachineMovementType: string
{
    use HasOptions;

    case Transfer = 'transfer';
    case Warehouse = 'warehouse';
    case Install = 'install';

    public function label(): string
    {
        return match ($this) {
            self::Transfer => 'Transferencia a otro cliente',
            self::Warehouse => 'Enviada a bodega',
            self::Install => 'Instalada desde bodega',
        };
    }
}

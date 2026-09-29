<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum RoleScope: string
{
    use HasOptions;

    case All = 'all';
    case Office = 'office';
    case Route = 'route';

    public function label(): string
    {
        return match ($this) {
            self::All => 'Todas las oficinas',
            self::Office => 'Solo su oficina',
            self::Route => 'Solo sus rutas asignadas',
        };
    }
}

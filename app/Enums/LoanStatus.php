<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum LoanStatus: string
{
    use HasOptions;

    case Active = 'active';
    case Paid = 'paid';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Activo',
            self::Paid => 'Pagado',
            self::Cancelled => 'Anulado',
        };
    }
}

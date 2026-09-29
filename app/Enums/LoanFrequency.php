<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use Carbon\CarbonImmutable;

enum LoanFrequency: string
{
    use HasOptions;

    case Daily = 'daily';
    case Weekly = 'weekly';
    case Biweekly = 'biweekly';
    case Monthly = 'monthly';

    public function label(): string
    {
        return match ($this) {
            self::Daily => 'Diario',
            self::Weekly => 'Semanal',
            self::Biweekly => 'Quincenal',
            self::Monthly => 'Mensual',
        };
    }

    public function addPeriods(CarbonImmutable $date, int $periods): CarbonImmutable
    {
        return match ($this) {
            self::Daily => $date->addDays($periods),
            self::Weekly => $date->addWeeks($periods),
            self::Biweekly => $date->addDays(15 * $periods),
            self::Monthly => $date->addMonthsNoOverflow($periods),
        };
    }
}

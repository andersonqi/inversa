<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Tipo de cambio de referencia: quetzales por una unidad de la moneda (USD).
 *
 * @property int $id
 * @property string $currency
 * @property string $rate
 * @property Carbon $rate_date
 * @property string $source
 * @property Carbon $fetched_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['currency', 'rate', 'rate_date', 'source', 'fetched_at'])]
class ExchangeRate extends Model
{
    /**
     * @return array{rate: float, date: string, source: string, fetched_at: string}
     */
    public function toPayload(): array
    {
        return [
            'rate' => (float) $this->rate,
            'date' => $this->rate_date->toDateString(),
            'source' => $this->source,
            'fetched_at' => $this->fetched_at->toIso8601String(),
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rate' => 'decimal:6',
            'rate_date' => 'date',
            'fetched_at' => 'datetime',
        ];
    }
}

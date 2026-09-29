<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Lectura de contadores de una máquina dentro de un corte.
 *
 * @property int $id
 * @property int $collection_id
 * @property int $machine_id
 * @property int $previous_in
 * @property int $current_in
 * @property int $previous_out
 * @property int $current_out
 * @property string $credit_value
 * @property string $amount_in
 * @property string $amount_out
 * @property string $net
 * @property bool $forced
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['collection_id', 'machine_id', 'previous_in', 'current_in', 'previous_out', 'current_out', 'credit_value', 'amount_in', 'amount_out', 'net', 'forced'])]
class CollectionItem extends Model
{
    /**
     * @return BelongsTo<Collection, $this>
     */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    /**
     * @return BelongsTo<Machine, $this>
     */
    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'previous_in' => 'integer',
            'current_in' => 'integer',
            'previous_out' => 'integer',
            'current_out' => 'integer',
            'credit_value' => 'decimal:2',
            'amount_in' => 'decimal:2',
            'amount_out' => 'decimal:2',
            'net' => 'decimal:2',
            'forced' => 'boolean',
        ];
    }
}

<?php

namespace App\Models;

use App\Enums\MachineMovementType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Movimiento de una máquina en campo: transferencia, envío a bodega o instalación.
 *
 * @property int $id
 * @property int $machine_id
 * @property int|null $user_id
 * @property MachineMovementType $type
 * @property int|null $from_client_id
 * @property int|null $to_client_id
 * @property int $counter_in
 * @property int $counter_out
 * @property string|null $reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['machine_id', 'user_id', 'type', 'from_client_id', 'to_client_id', 'counter_in', 'counter_out', 'reason'])]
class MachineMovement extends Model
{
    /**
     * @return BelongsTo<Machine, $this>
     */
    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function fromClient(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'from_client_id');
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function toClient(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'to_client_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => MachineMovementType::class,
            'counter_in' => 'integer',
            'counter_out' => 'integer',
        ];
    }
}

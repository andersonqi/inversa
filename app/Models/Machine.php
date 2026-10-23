<?php

namespace App\Models;

use App\Enums\MachineStatus;
use App\Enums\RoleScope;
use App\Models\Concerns\ChecksVisibility;
use App\Models\Contracts\VisibleToUser;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $office_id
 * @property int|null $client_id
 * @property string $code
 * @property string|null $serial
 * @property string|null $brand
 * @property string|null $model
 * @property string $credit_value
 * @property int $counter_in
 * @property int $counter_out
 * @property string|null $purchase_cost
 * @property Carbon|null $installed_at
 * @property MachineStatus $status
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['office_id', 'client_id', 'code', 'serial', 'brand', 'model', 'credit_value', 'counter_in', 'counter_out', 'purchase_cost', 'installed_at', 'status', 'notes'])]
class Machine extends Model implements VisibleToUser
{
    use ChecksVisibility;

    /**
     * @return BelongsTo<Office, $this>
     */
    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return HasMany<CollectionItem, $this>
     */
    public function collectionItems(): HasMany
    {
        return $this->hasMany(CollectionItem::class);
    }

    /**
     * @return HasMany<MachineMovement, $this>
     */
    public function movements(): HasMany
    {
        return $this->hasMany(MachineMovement::class);
    }

    /**
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function visibleTo(Builder $query, User $user): void
    {
        match ($user->scope()) {
            RoleScope::All => null,
            RoleScope::Office => $query->where($query->qualifyColumn('office_id'), $user->office_id),
            RoleScope::Route => $query->whereHas('client', fn (Builder $q) => $q->visibleTo($user)),
        };
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'credit_value' => 'decimal:2',
            'purchase_cost' => 'decimal:2',
            'counter_in' => 'integer',
            'counter_out' => 'integer',
            'installed_at' => 'date',
            'status' => MachineStatus::class,
        ];
    }
}

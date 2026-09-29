<?php

namespace App\Models;

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
 * Ruta de cobro: recorrido de un cobrador por un grupo de clientes de una oficina.
 *
 * @property int $id
 * @property int $office_id
 * @property int|null $collector_id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['office_id', 'collector_id', 'code', 'name', 'description', 'is_active'])]
class CollectionRoute extends Model implements VisibleToUser
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
     * @return BelongsTo<User, $this>
     */
    public function collector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collector_id');
    }

    /**
     * @return HasMany<Client, $this>
     */
    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
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
            RoleScope::Route => $query->where($query->qualifyColumn('collector_id'), $user->id),
        };
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}

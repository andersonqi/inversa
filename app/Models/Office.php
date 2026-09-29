<?php

namespace App\Models;

use App\Models\Concerns\ChecksVisibility;
use App\Models\Contracts\VisibleToUser;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Sede operativa: agrupa rutas, cobradores, máquinas, gastos y la caja de una zona.
 *
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $city
 * @property string|null $address
 * @property string|null $phone
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['code', 'name', 'city', 'address', 'phone', 'is_active'])]
class Office extends Model implements VisibleToUser
{
    use ChecksVisibility;

    /**
     * @return HasMany<CollectionRoute, $this>
     */
    public function routes(): HasMany
    {
        return $this->hasMany(CollectionRoute::class);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * @return HasMany<Machine, $this>
     */
    public function machines(): HasMany
    {
        return $this->hasMany(Machine::class);
    }

    /**
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function visibleTo(Builder $query, User $user): void
    {
        if (! $user->seesAllOffices()) {
            $query->whereKey($user->office_id);
        }
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}

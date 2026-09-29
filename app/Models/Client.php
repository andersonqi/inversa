<?php

namespace App\Models;

use App\Enums\LoanStatus;
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
 * Cliente: local/negocio donde se instalan máquinas. Pertenece a una ruta.
 *
 * @property int $id
 * @property int $collection_route_id
 * @property string $name
 * @property string|null $business_name
 * @property string|null $document
 * @property string|null $phone
 * @property string|null $address
 * @property string $commission_percent
 * @property string $loss_balance
 * @property int $visit_order
 * @property string|null $notes
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['collection_route_id', 'name', 'business_name', 'document', 'phone', 'address', 'commission_percent', 'loss_balance', 'visit_order', 'notes', 'is_active'])]
class Client extends Model implements VisibleToUser
{
    use ChecksVisibility;

    /**
     * @return BelongsTo<CollectionRoute, $this>
     */
    public function collectionRoute(): BelongsTo
    {
        return $this->belongsTo(CollectionRoute::class);
    }

    /**
     * @return HasMany<Machine, $this>
     */
    public function machines(): HasMany
    {
        return $this->hasMany(Machine::class);
    }

    /**
     * @return HasMany<Loan, $this>
     */
    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class);
    }

    /**
     * @return HasMany<Loan, $this>
     */
    public function activeLoans(): HasMany
    {
        return $this->loans()->where('status', LoanStatus::Active);
    }

    /**
     * @return HasMany<Collection, $this>
     */
    public function collections(): HasMany
    {
        return $this->hasMany(Collection::class);
    }

    /**
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function visibleTo(Builder $query, User $user): void
    {
        if (! $user->seesAllOffices()) {
            $query->whereHas('collectionRoute', fn (Builder $q) => $q->visibleTo($user));
        }
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'commission_percent' => 'decimal:2',
            'loss_balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}

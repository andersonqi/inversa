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
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * Corte: visita del cobrador a un cliente donde se leen los contadores de sus máquinas.
 *
 * @property int $id
 * @property int $office_id
 * @property int $collection_route_id
 * @property int $client_id
 * @property int $user_id
 * @property Carbon $collected_on
 * @property string $total_in
 * @property string $total_out
 * @property string $net
 * @property string $commission_percent
 * @property string $client_share
 * @property string $company_share
 * @property string $loss_offset
 * @property string $loss_added
 * @property string $loan_deduction
 * @property string $client_paid
 * @property string $cash_delivered
 * @property string|null $notes
 * @property string|null $signature_path
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['office_id', 'collection_route_id', 'client_id', 'user_id', 'collected_on', 'total_in', 'total_out', 'net', 'commission_percent', 'client_share', 'company_share', 'loss_offset', 'loss_added', 'loan_deduction', 'client_paid', 'cash_delivered', 'notes', 'signature_path'])]
class Collection extends Model implements VisibleToUser
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
     * @return BelongsTo<CollectionRoute, $this>
     */
    public function collectionRoute(): BelongsTo
    {
        return $this->belongsTo(CollectionRoute::class);
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<CollectionItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(CollectionItem::class);
    }

    /**
     * @return HasOne<LoanPayment, $this>
     */
    public function loanPayment(): HasOne
    {
        return $this->hasOne(LoanPayment::class);
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
            RoleScope::Route => $query->whereIn($query->qualifyColumn('collection_route_id'), $user->routeIds()),
        };
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'collected_on' => 'date',
            'total_in' => 'decimal:2',
            'total_out' => 'decimal:2',
            'net' => 'decimal:2',
            'commission_percent' => 'decimal:2',
            'client_share' => 'decimal:2',
            'company_share' => 'decimal:2',
            'loss_offset' => 'decimal:2',
            'loss_added' => 'decimal:2',
            'loan_deduction' => 'decimal:2',
            'client_paid' => 'decimal:2',
            'cash_delivered' => 'decimal:2',
        ];
    }
}

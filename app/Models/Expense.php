<?php

namespace App\Models;

use App\Enums\ExpenseCategory;
use App\Enums\RoleScope;
use App\Models\Concerns\ChecksVisibility;
use App\Models\Contracts\VisibleToUser;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $office_id
 * @property int|null $collection_route_id
 * @property int|null $machine_id
 * @property int $user_id
 * @property ExpenseCategory $category
 * @property string $amount
 * @property Carbon $spent_on
 * @property string|null $description
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['office_id', 'collection_route_id', 'machine_id', 'user_id', 'category', 'amount', 'spent_on', 'description'])]
class Expense extends Model implements VisibleToUser
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
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function visibleTo(Builder $query, User $user): void
    {
        match ($user->scope()) {
            RoleScope::All => null,
            RoleScope::Office => $query->where($query->qualifyColumn('office_id'), $user->office_id),
            RoleScope::Route => $query->where($query->qualifyColumn('user_id'), $user->id),
        };
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'category' => ExpenseCategory::class,
            'amount' => 'decimal:2',
            'spent_on' => 'date',
        ];
    }
}

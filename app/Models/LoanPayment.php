<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $loan_id
 * @property int|null $collection_id
 * @property int $user_id
 * @property string $amount
 * @property Carbon $paid_on
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['loan_id', 'collection_id', 'user_id', 'amount', 'paid_on', 'notes'])]
class LoanPayment extends Model
{
    /**
     * @return BelongsTo<Loan, $this>
     */
    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    /**
     * @return BelongsTo<Collection, $this>
     */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_on' => 'date',
        ];
    }
}

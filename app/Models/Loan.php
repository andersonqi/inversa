<?php

namespace App\Models;

use App\Enums\LoanFrequency;
use App\Enums\LoanStatus;
use App\Enums\RoleScope;
use App\Models\Concerns\ChecksVisibility;
use App\Models\Contracts\VisibleToUser;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
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
 * @property int $client_id
 * @property int $user_id
 * @property string $principal
 * @property string $interest_percent
 * @property string $total
 * @property string $balance
 * @property LoanFrequency $frequency
 * @property int $installments
 * @property string $installment_amount
 * @property CarbonImmutable $issued_on
 * @property CarbonImmutable $first_due_on
 * @property LoanStatus $status
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['office_id', 'client_id', 'user_id', 'principal', 'interest_percent', 'total', 'balance', 'frequency', 'installments', 'installment_amount', 'issued_on', 'first_due_on', 'status', 'notes'])]
class Loan extends Model implements VisibleToUser
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
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<LoanPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(LoanPayment::class);
    }

    /**
     * Cuotas que ya deberían estar pagadas a la fecha indicada.
     */
    public function installmentsDueBy(CarbonInterface $date): int
    {
        if ($date->lt($this->first_due_on)) {
            return 0;
        }

        $due = 0;

        while ($due < $this->installments
            && $this->frequency->addPeriods($this->first_due_on, $due)->lte($date)) {
            $due++;
        }

        return $due;
    }

    /**
     * Monto vencido y no pagado a la fecha indicada.
     */
    public function arrearsAt(CarbonInterface $date): float
    {
        $expectedPaid = min((float) $this->total, $this->installmentsDueBy($date) * (float) $this->installment_amount);
        $paid = (float) $this->total - (float) $this->balance;

        return round(max(0, $expectedPaid - $paid), 2);
    }

    /**
     * Agrega la columna "arrears" (mora a la fecha) calculada en SQL con la misma regla
     * que arrearsAt(): cuotas vencidas × valor de cuota − lo ya pagado.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function withArrears(Builder $query, CarbonInterface $date): void
    {
        $d = $date->toDateString();
        $table = 'loans';

        // Resta de fechas en Postgres = días enteros; la división entera trunca igual que el cálculo en PHP.
        $days = "(cast(? as date) - {$table}.first_due_on)";
        $months = "(cast(extract(year from age(cast(? as date), {$table}.first_due_on)) * 12 + extract(month from age(cast(? as date), {$table}.first_due_on)) as integer))";

        // Mensual: los meses completos + 1, y uno más si el recorte de fin de mes ya cumplió la siguiente cuota.
        $due = "case
            when cast(? as date) < {$table}.first_due_on then 0
            else least({$table}.installments, case {$table}.frequency
                when 'daily' then {$days} + 1
                when 'weekly' then {$days} / 7 + 1
                when 'biweekly' then {$days} / 15 + 1
                else {$months} + 1 + case when {$table}.first_due_on + make_interval(months => {$months} + 1) <= cast(? as date) then 1 else 0 end
            end)
        end";

        $bindings = array_fill(0, substr_count($due, '?'), $d);

        if ($query->getQuery()->columns === null) {
            $query->select("{$table}.*");
        }

        $query->selectRaw(
            "round(greatest(0, least({$table}.total, cast(({$due}) as integer) * {$table}.installment_amount) - ({$table}.total - {$table}.balance)), 2) as arrears",
            $bindings,
        );
    }

    /**
     * Recalcula el saldo a partir de los abonos registrados.
     */
    public function refreshBalance(): void
    {
        $paid = (float) $this->payments()->sum('amount');
        $this->balance = (string) round(max(0, (float) $this->total - $paid), 2);

        if ($this->status !== LoanStatus::Cancelled) {
            $this->status = (float) $this->balance <= 0 ? LoanStatus::Paid : LoanStatus::Active;
        }

        $this->save();
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
            'principal' => 'decimal:2',
            'interest_percent' => 'decimal:2',
            'total' => 'decimal:2',
            'balance' => 'decimal:2',
            'installment_amount' => 'decimal:2',
            'installments' => 'integer',
            'frequency' => LoanFrequency::class,
            'status' => LoanStatus::class,
            'issued_on' => 'date',
            'first_due_on' => 'date',
        ];
    }
}

<?php

namespace Tests\Feature;

use App\Enums\LoanFrequency;
use App\Models\Loan;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

/**
 * La mora se calcula en PHP (Loan::arrearsAt) y en SQL (scope withArrears, usado en reportes).
 * Ambas deben coincidir siempre.
 */
class LoanArrearsTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    private function makeLoan(LoanFrequency $frequency, string $firstDueOn, int $installments = 6, float $installmentAmount = 10000, ?float $balance = null): Loan
    {
        $total = $installments * $installmentAmount;

        return Loan::create([
            'office_id' => $this->office->id,
            'client_id' => $this->client->id,
            'user_id' => $this->admin->id,
            'principal' => $total,
            'interest_percent' => 0,
            'total' => $total,
            'balance' => $balance ?? $total,
            'frequency' => $frequency,
            'installments' => $installments,
            'installment_amount' => $installmentAmount,
            'issued_on' => CarbonImmutable::parse($firstDueOn)->subMonth()->toDateString(),
            'first_due_on' => $firstDueOn,
        ])->fresh() ?? throw new \RuntimeException('Loan not persisted');
    }

    private function sqlArrears(Loan $loan, CarbonImmutable $date): float
    {
        $row = Loan::query()->withArrears($date)->find($loan->id);
        $this->assertNotNull($row);

        return (float) $row->getAttribute('arrears');
    }

    /**
     * Compara PHP vs SQL y, si se indica, contra el valor esperado.
     */
    private function assertArrears(Loan $loan, string $date, ?float $expected = null): void
    {
        $day = CarbonImmutable::parse($date);
        $php = $loan->arrearsAt($day);
        $sql = $this->sqlArrears($loan, $day);

        $label = "{$loan->frequency->value} loan (first due {$loan->first_due_on->toDateString()}) at {$date}";

        $this->assertEqualsWithDelta($php, $sql, 0.01, "PHP/SQL arrears mismatch for {$label}");

        if ($expected !== null) {
            $this->assertEqualsWithDelta($expected, $php, 0.01, "Unexpected arrears for {$label}");
        }
    }

    /**
     * Recorre día a día un rango y compara ambas implementaciones.
     */
    private function sweep(Loan $loan, string $from, string $to): void
    {
        for ($day = CarbonImmutable::parse($from); $day->lte(CarbonImmutable::parse($to)); $day = $day->addDay()) {
            $this->assertArrears($loan, $day->toDateString());
        }
    }

    public function test_daily_loan(): void
    {
        $loan = $this->makeLoan(LoanFrequency::Daily, '2026-03-10');

        $this->assertArrears($loan, '2026-03-09', 0);
        $this->assertArrears($loan, '2026-03-10', 10000);
        $this->assertArrears($loan, '2026-03-12', 30000);
        $this->assertArrears($loan, '2026-03-15', 60000);
        $this->assertArrears($loan, '2026-04-30', 60000);

        $this->sweep($loan, '2026-03-05', '2026-03-20');
    }

    public function test_weekly_loan(): void
    {
        $loan = $this->makeLoan(LoanFrequency::Weekly, '2026-03-10');

        $this->assertArrears($loan, '2026-03-09', 0);
        $this->assertArrears($loan, '2026-03-10', 10000);
        $this->assertArrears($loan, '2026-03-16', 10000);
        $this->assertArrears($loan, '2026-03-17', 20000);
        $this->assertArrears($loan, '2026-03-28', 30000);
        $this->assertArrears($loan, '2026-04-14', 60000);
        $this->assertArrears($loan, '2026-06-01', 60000);

        $this->sweep($loan, '2026-03-05', '2026-04-25');
    }

    public function test_biweekly_loan(): void
    {
        $loan = $this->makeLoan(LoanFrequency::Biweekly, '2026-03-10');

        $this->assertArrears($loan, '2026-03-09', 0);
        $this->assertArrears($loan, '2026-03-10', 10000);
        $this->assertArrears($loan, '2026-03-24', 10000);
        $this->assertArrears($loan, '2026-03-25', 20000);
        $this->assertArrears($loan, '2026-04-15', 30000);
        $this->assertArrears($loan, '2026-05-24', 60000);
        $this->assertArrears($loan, '2026-08-01', 60000);

        $this->sweep($loan, '2026-03-05', '2026-06-05');
    }

    public function test_monthly_loan(): void
    {
        $loan = $this->makeLoan(LoanFrequency::Monthly, '2026-03-10');

        $this->assertArrears($loan, '2026-03-09', 0);
        $this->assertArrears($loan, '2026-03-10', 10000);
        $this->assertArrears($loan, '2026-04-09', 10000);
        $this->assertArrears($loan, '2026-04-10', 20000);
        $this->assertArrears($loan, '2026-05-20', 30000);
        $this->assertArrears($loan, '2026-08-10', 60000);
        $this->assertArrears($loan, '2027-01-01', 60000);

        $this->sweep($loan, '2026-03-05', '2026-09-15');
    }

    public function test_monthly_loan_due_on_month_end_clamps_to_short_months(): void
    {
        $loan = $this->makeLoan(LoanFrequency::Monthly, '2026-01-31');

        $this->assertArrears($loan, '2026-01-30', 0);
        $this->assertArrears($loan, '2026-01-31', 10000);
        $this->assertArrears($loan, '2026-02-27', 10000);
        // Febrero no tiene 31: la 2.ª cuota vence el 28.
        $this->assertArrears($loan, '2026-02-28', 20000);
        $this->assertArrears($loan, '2026-03-30', 20000);
        $this->assertArrears($loan, '2026-03-31', 30000);
        $this->assertArrears($loan, '2026-04-30', 40000);
        $this->assertArrears($loan, '2026-06-30', 60000);

        $this->sweep($loan, '2026-01-25', '2026-07-05');
    }

    public function test_other_month_end_anchors_match(): void
    {
        foreach (['2026-01-30', '2026-01-29', '2026-03-31', '2026-08-31', '2025-12-31'] as $firstDue) {
            $loan = $this->makeLoan(LoanFrequency::Monthly, $firstDue, installments: 8);
            $start = CarbonImmutable::parse($firstDue);

            $this->sweep($loan, $start->subDays(2)->toDateString(), $start->addMonths(9)->toDateString());
        }
    }

    public function test_partially_paid_loan(): void
    {
        // Pagó 25000 de 60000: 2.5 cuotas.
        $loan = $this->makeLoan(LoanFrequency::Weekly, '2026-03-10', balance: 35000);

        $this->assertArrears($loan, '2026-03-09', 0);
        $this->assertArrears($loan, '2026-03-17', 0);
        $this->assertArrears($loan, '2026-03-24', 5000);
        $this->assertArrears($loan, '2026-04-01', 15000);
        $this->assertArrears($loan, '2026-05-01', 35000);

        $this->sweep($loan, '2026-03-05', '2026-04-25');

        $monthly = $this->makeLoan(LoanFrequency::Monthly, '2026-01-31', balance: 45000);

        $this->assertArrears($monthly, '2026-02-28', 5000);
        $this->sweep($monthly, '2026-01-25', '2026-07-05');
    }

    public function test_uneven_installments_are_capped_at_total(): void
    {
        // 100000 / 3 = 33333.33 por cuota; tras la última cuota la mora no supera el total.
        $loan = $this->makeLoan(LoanFrequency::Daily, '2026-03-10', installments: 3, installmentAmount: 33333.33);
        $loan->update(['total' => 100000, 'balance' => 100000]);

        $this->assertArrears($loan, '2026-03-11', 66666.66);
        $this->assertArrears($loan, '2026-03-12', 99999.99);
        $this->assertArrears($loan, '2026-04-01', 99999.99);
    }

    public function test_scope_works_alongside_other_selects_for_multiple_loans(): void
    {
        $weekly = $this->makeLoan(LoanFrequency::Weekly, '2026-03-10');
        $monthly = $this->makeLoan(LoanFrequency::Monthly, '2026-01-31');
        $date = CarbonImmutable::parse('2026-03-20');

        $rows = Loan::query()->withArrears($date)->whereIn('id', [$weekly->id, $monthly->id])->get()->keyBy('id');

        $this->assertEqualsWithDelta($weekly->arrearsAt($date), (float) $rows[$weekly->id]->getAttribute('arrears'), 0.01);
        $this->assertEqualsWithDelta($monthly->arrearsAt($date), (float) $rows[$monthly->id]->getAttribute('arrears'), 0.01);
        $this->assertSame('60000.00', $rows[$weekly->id]->total);
    }
}

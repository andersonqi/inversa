<?php

namespace Tests\Feature;

use App\Enums\LoanFrequency;
use App\Enums\LoanStatus;
use App\Models\Loan;
use App\Models\LoanPayment;
use App\Services\CollectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class LoanManagementTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function loanPayload(array $overrides = []): array
    {
        return [
            'client_id' => $this->client->id,
            'principal' => 100000,
            'interest_percent' => 15,
            'frequency' => 'weekly',
            'installments' => 3,
            'issued_on' => now()->toDateString(),
            'first_due_on' => now()->addWeek()->toDateString(),
            'notes' => 'Préstamo para mobiliario',
            ...$overrides,
        ];
    }

    private function pay(float|int|string $amount): void
    {
        $this->actingAs($this->admin)
            ->post(route('loans.payments.store', $this->loan), ['amount' => $amount, 'paid_on' => now()->toDateString()])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('loans.show', $this->loan));
    }

    public function test_store_computes_totals_and_takes_office_from_client_route(): void
    {
        $this->actingAs($this->admin)
            ->post(route('loans.store'), $this->loanPayload())
            ->assertSessionHasNoErrors();

        $loan = Loan::where('notes', 'Préstamo para mobiliario')->firstOrFail();

        // 100000 × 1.15 = 115000; 115000 / 3 = 38333.33.
        $this->assertSame('115000.00', $loan->total);
        $this->assertSame('115000.00', $loan->balance);
        $this->assertSame('38333.33', $loan->installment_amount);
        $this->assertSame($this->office->id, $loan->office_id);
        $this->assertSame($this->admin->id, $loan->user_id);
        $this->assertSame(LoanStatus::Active, $loan->status);
        $this->assertSame(LoanFrequency::Weekly, $loan->frequency);
    }

    public function test_store_redirects_to_show(): void
    {
        $response = $this->actingAs($this->admin)->post(route('loans.store'), $this->loanPayload());

        $response->assertRedirect(route('loans.show', Loan::latest('id')->firstOrFail()));
    }

    public function test_store_validates_input(): void
    {
        $this->actingAs($this->admin)
            ->post(route('loans.store'), $this->loanPayload([
                'principal' => 0,
                'installments' => 0,
                'frequency' => 'yearly',
                'first_due_on' => now()->subDay()->toDateString(),
            ]))
            ->assertSessionHasErrors(['principal', 'installments', 'frequency', 'first_due_on']);

        $this->assertSame(1, Loan::count());
    }

    public function test_supervisor_cannot_lend_to_client_of_other_office(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('loans.store'), $this->loanPayload(['client_id' => $this->otherClient->id]))
            ->assertNotFound();

        $this->assertSame(1, Loan::count());
    }

    public function test_payment_reduces_balance(): void
    {
        $this->pay(15000);

        $loan = $this->loan->fresh();
        $this->assertSame('105000.00', $loan->balance);
        $this->assertSame(LoanStatus::Active, $loan->status);
        $this->assertSame($this->admin->id, LoanPayment::where('loan_id', $this->loan->id)->firstOrFail()->user_id);
    }

    public function test_payment_greater_than_balance_is_rejected(): void
    {
        $this->actingAs($this->admin)
            ->post(route('loans.payments.store', $this->loan), ['amount' => 120000.01, 'paid_on' => now()->toDateString()])
            ->assertSessionHasErrors('amount');

        $this->assertSame('120000.00', $this->loan->fresh()?->balance);
        $this->assertSame(0, $this->loan->payments()->count());
    }

    public function test_payment_in_the_future_is_rejected(): void
    {
        $this->actingAs($this->admin)
            ->post(route('loans.payments.store', $this->loan), ['amount' => 100, 'paid_on' => now()->addDay()->toDateString()])
            ->assertSessionHasErrors('paid_on');
    }

    public function test_paying_full_balance_marks_loan_paid(): void
    {
        $this->pay(20000);
        $this->pay(100000);

        $loan = $this->loan->fresh();
        $this->assertSame('0.00', $loan->balance);
        $this->assertSame(LoanStatus::Paid, $loan->status);
    }

    public function test_cancel_sets_status_cancelled(): void
    {
        $this->actingAs($this->admin)
            ->post(route('loans.cancel', $this->loan))
            ->assertRedirect(route('loans.show', $this->loan));

        $this->assertSame(LoanStatus::Cancelled, $this->loan->fresh()?->status);

        // Un préstamo anulado no acepta abonos.
        $this->actingAs($this->admin)
            ->post(route('loans.payments.store', $this->loan), ['amount' => 100, 'paid_on' => now()->toDateString()])
            ->assertStatus(422);

        $this->assertSame(0, $this->loan->payments()->count());
    }

    public function test_deleting_direct_payment_restores_balance(): void
    {
        $this->pay(120000);
        $this->assertSame(LoanStatus::Paid, $this->loan->fresh()?->status);

        $payment = LoanPayment::where('loan_id', $this->loan->id)->firstOrFail();

        $this->actingAs($this->admin)
            ->delete(route('loans.payments.destroy', [$this->loan, $payment]))
            ->assertRedirect(route('loans.show', $this->loan));

        $this->assertModelMissing($payment);
        $loan = $this->loan->fresh();
        $this->assertSame('120000.00', $loan->balance);
        $this->assertSame(LoanStatus::Active, $loan->status);
    }

    public function test_payment_must_belong_to_the_loan_in_url(): void
    {
        $this->pay(1000);
        $payment = LoanPayment::where('loan_id', $this->loan->id)->firstOrFail();

        $otherLoan = Loan::create([
            ...$this->loan->only(['office_id', 'client_id', 'user_id', 'principal', 'interest_percent', 'total', 'balance', 'frequency', 'installments', 'installment_amount', 'issued_on', 'first_due_on']),
        ]);

        $this->actingAs($this->admin)
            ->delete(route('loans.payments.destroy', [$otherLoan, $payment]))
            ->assertNotFound();

        $this->assertModelExists($payment);
    }

    public function test_payment_from_a_collection_cannot_be_deleted_directly(): void
    {
        // La máquina está en 1100/550 (crédito 100): +100/+10 créditos = 9000 netos, comisión 30% = 2700.
        $collection = app(CollectionService::class)->record($this->collector, $this->client, [
            'collected_on' => now()->toDateString(),
            'loan_id' => $this->loan->id,
            'loan_deduction' => 2000,
            'items' => [['machine_id' => $this->machine->id, 'current_in' => 1200, 'current_out' => 560]],
        ]);

        $this->assertSame('118000.00', $this->loan->fresh()?->balance);

        $payment = LoanPayment::where('collection_id', $collection->id)->firstOrFail();

        $this->actingAs($this->admin)
            ->from(route('loans.show', $this->loan))
            ->delete(route('loans.payments.destroy', [$this->loan, $payment]))
            ->assertRedirect(route('loans.show', $this->loan))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertModelExists($payment);
        $this->assertSame('118000.00', $this->loan->fresh()?->balance);
    }

    public function test_collector_can_pay_but_cannot_create_or_cancel_loans(): void
    {
        $this->actingAs($this->collector)
            ->post(route('loans.payments.store', $this->loan), ['amount' => 5000, 'paid_on' => now()->toDateString()])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('loans.show', $this->loan));

        $this->assertSame('115000.00', $this->loan->fresh()?->balance);

        $this->actingAs($this->collector)->post(route('loans.store'), $this->loanPayload())->assertForbidden();
        $this->actingAs($this->collector)->post(route('loans.cancel', $this->loan))->assertForbidden();

        $payment = LoanPayment::where('loan_id', $this->loan->id)->firstOrFail();
        $this->actingAs($this->collector)
            ->delete(route('loans.payments.destroy', [$this->loan, $payment]))
            ->assertForbidden();

        $this->assertSame(1, Loan::count());
        $this->assertSame(LoanStatus::Active, $this->loan->fresh()?->status);
    }

    public function test_collector_cannot_pay_loans_outside_own_routes(): void
    {
        $otherLoan = Loan::create([
            'office_id' => $this->otherOffice->id,
            'client_id' => $this->otherClient->id,
            'user_id' => $this->admin->id,
            'principal' => 1000,
            'interest_percent' => 0,
            'total' => 1000,
            'balance' => 1000,
            'frequency' => LoanFrequency::Daily,
            'installments' => 10,
            'installment_amount' => 100,
            'issued_on' => now()->toDateString(),
            'first_due_on' => now()->toDateString(),
        ]);

        $this->actingAs($this->collector)
            ->post(route('loans.payments.store', $otherLoan), ['amount' => 100, 'paid_on' => now()->toDateString()])
            ->assertNotFound();

        $this->assertSame('1000.00', $otherLoan->fresh()?->balance);
    }
}

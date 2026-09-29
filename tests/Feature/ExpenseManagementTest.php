<?php

namespace Tests\Feature;

use App\Enums\ExpenseCategory;
use App\Models\Expense;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class ExpenseManagementTest extends TestCase
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
    private function payload(array $overrides = []): array
    {
        return [
            'office_id' => $this->office->id,
            'collection_route_id' => $this->route->id,
            'machine_id' => null,
            'category' => 'maintenance',
            'amount' => '2500.50',
            'spent_on' => now()->toDateString(),
            'description' => 'Cambio de billetero',
            ...$overrides,
        ];
    }

    public function test_create_assigns_the_acting_user(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('expenses.store'), $this->payload(['machine_id' => $this->machine->id, 'user_id' => $this->admin->id]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('expenses.index'))
            ->assertInertiaFlash('toast.type', 'success');

        $expense = Expense::where('description', 'Cambio de billetero')->firstOrFail();
        $this->assertSame($this->supervisor->id, $expense->user_id);
        $this->assertSame($this->office->id, $expense->office_id);
        $this->assertSame($this->route->id, $expense->collection_route_id);
        $this->assertSame($this->machine->id, $expense->machine_id);
        $this->assertSame(ExpenseCategory::Maintenance, $expense->category);
        $this->assertSame('2500.50', $expense->amount);
    }

    public function test_collector_can_register_expense(): void
    {
        $this->actingAs($this->collector)
            ->post(route('expenses.store'), $this->payload())
            ->assertSessionHasNoErrors();

        $this->assertSame($this->collector->id, Expense::where('description', 'Cambio de billetero')->firstOrFail()->user_id);
    }

    public function test_route_and_machine_must_belong_to_chosen_office(): void
    {
        $this->actingAs($this->admin)
            ->post(route('expenses.store'), $this->payload(['collection_route_id' => $this->otherRoute->id]))
            ->assertSessionHasErrors('collection_route_id');

        $this->actingAs($this->admin)
            ->post(route('expenses.store'), $this->payload(['machine_id' => $this->otherMachine->id]))
            ->assertSessionHasErrors('machine_id');

        $this->assertDatabaseMissing('expenses', ['description' => 'Cambio de billetero']);
    }

    public function test_future_date_is_rejected(): void
    {
        $this->actingAs($this->admin)
            ->post(route('expenses.store'), $this->payload(['spent_on' => now()->addDay()->toDateString()]))
            ->assertSessionHasErrors('spent_on');

        $this->assertDatabaseMissing('expenses', ['description' => 'Cambio de billetero']);
    }

    public function test_amount_and_category_are_validated(): void
    {
        $this->actingAs($this->admin)
            ->post(route('expenses.store'), $this->payload(['amount' => 0, 'category' => 'casino']))
            ->assertSessionHasErrors(['amount', 'category']);
    }

    public function test_supervisor_cannot_create_expense_for_other_office(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('expenses.store'), $this->payload(['office_id' => $this->otherOffice->id, 'collection_route_id' => $this->otherRoute->id]))
            ->assertForbidden();

        $this->assertDatabaseMissing('expenses', ['description' => 'Cambio de billetero']);
    }

    public function test_index_is_scoped_by_role(): void
    {
        // Otro gasto de la misma oficina registrado por el supervisor.
        Expense::create([
            'office_id' => $this->office->id,
            'user_id' => $this->supervisor->id,
            'category' => ExpenseCategory::Services,
            'amount' => 1000,
            'spent_on' => now()->toDateString(),
        ]);

        $this->actingAs($this->collector)
            ->get(route('expenses.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('expenses/index')
                ->has('expenses.data', 1)
                ->where('expenses.data.0.id', $this->expense->id));

        $this->actingAs($this->supervisor)
            ->get(route('expenses.index'))
            ->assertInertia(fn (Assert $page) => $page->component('expenses/index')->has('expenses.data', 2));

        $this->actingAs($this->admin)
            ->get(route('expenses.index'))
            ->assertInertia(fn (Assert $page) => $page->component('expenses/index')->has('expenses.data', 3));
    }

    public function test_expense_can_be_updated(): void
    {
        $this->actingAs($this->admin)
            ->put(route('expenses.update', $this->expense), $this->payload([
                'category' => 'fuel',
                'amount' => 7000,
                'description' => 'Gasolina corregida',
            ]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('expenses.index'));

        $expense = $this->expense->fresh();
        $this->assertSame('7000.00', $expense->amount);
        $this->assertSame('Gasolina corregida', $expense->description);
        // El autor original se conserva.
        $this->assertSame($this->collector->id, $expense->user_id);
    }

    public function test_expense_can_be_deleted(): void
    {
        $this->actingAs($this->admin)
            ->delete(route('expenses.destroy', $this->expense))
            ->assertRedirect(route('expenses.index'));

        $this->assertModelMissing($this->expense);
    }

    public function test_users_cannot_touch_expenses_outside_their_scope(): void
    {
        $otherExpense = Expense::where('office_id', $this->otherOffice->id)->firstOrFail();

        $this->actingAs($this->supervisor)
            ->put(route('expenses.update', $otherExpense), $this->payload())
            ->assertNotFound();

        $this->actingAs($this->supervisor)
            ->delete(route('expenses.destroy', $otherExpense))
            ->assertNotFound();

        // Un cobrador solo ve (y edita) sus propios gastos.
        $supervisorExpense = Expense::create([
            'office_id' => $this->office->id,
            'user_id' => $this->supervisor->id,
            'category' => ExpenseCategory::Rent,
            'amount' => 1000,
            'spent_on' => now()->toDateString(),
        ]);

        $this->actingAs($this->collector)
            ->delete(route('expenses.destroy', $supervisorExpense))
            ->assertNotFound();

        $this->assertModelExists($otherExpense);
        $this->assertModelExists($supervisorExpense);
    }
}

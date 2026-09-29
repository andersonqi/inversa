<?php

namespace Tests\Feature;

use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Collection;
use App\Models\CollectionRoute;
use App\Models\Machine;
use App\Models\Office;
use App\Models\Role;
use App\Models\User;
use App\Services\CollectionService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Reglas de pérdidas con la pulpería (dueña del local donde está la máquina):
 * 1. Máquina en pérdida no se corta: se espera a que recupere.
 * 2. Corte forzado: la pérdida se reparte según la comisión y se rebaja de la ganancia
 *    de las otras máquinas de la pulpería en el mismo corte.
 * 3. Si la parte de la pulpería queda negativa, se rebaja de sus próximas ganancias.
 */
class LossSharingTest extends TestCase
{
    use RefreshDatabase;

    private User $collector;

    private Client $client;

    private Machine $winner;

    private Machine $loser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        $office = Office::create(['code' => 'CEN', 'name' => 'Central']);
        $this->collector = User::factory()->create([
            'role_id' => Role::where('name', 'Cobrador')->value('id'),
            'office_id' => $office->id,
        ]);
        $route = CollectionRoute::create(['office_id' => $office->id, 'collector_id' => $this->collector->id, 'code' => 'R1', 'name' => 'Ruta 1']);
        $this->client = Client::create(['collection_route_id' => $route->id, 'name' => 'Pulpería La Esquina', 'commission_percent' => 30]);

        // Crédito de ₡100: 10 créditos = ₡1.000.
        $this->winner = $this->machine($office, 'GANA');
        $this->loser = $this->machine($office, 'PIERDE');
    }

    public function test_a_losing_machine_is_not_cut_unless_forced(): void
    {
        $this->cut([
            ['machine_id' => $this->winner->id, 'current_in' => 1100, 'current_out' => 500],
            ['machine_id' => $this->loser->id, 'current_in' => 1010, 'current_out' => 530],
        ])->assertSessionHasErrors('items.1.forced');

        $this->assertSame(0, Collection::count());
        $this->assertSame(1000, $this->loser->fresh()->counter_in);
    }

    public function test_waiting_machine_keeps_its_counters_and_recovers_the_loss_in_a_later_cut(): void
    {
        // Visita 1: solo se corta la máquina con ganancia; la perdedora espera.
        $this->cut([['machine_id' => $this->winner->id, 'current_in' => 1100, 'current_out' => 500]])->assertSessionHasNoErrors();

        $this->assertSame(1000, $this->loser->fresh()->counter_in);
        $this->assertSame(500, $this->loser->fresh()->counter_out);

        // Visita 2: la perdedora recuperó (-₡2.000 que ya se compensaron): se corta todo el período.
        $this->cut([['machine_id' => $this->loser->id, 'current_in' => 1050, 'current_out' => 520]])->assertSessionHasNoErrors();

        $second = Collection::latest('id')->firstOrFail();
        $this->assertSame('3000.00', $second->net);
        $this->assertSame('900.00', $second->client_share);
        $this->assertSame('0.00', $this->client->fresh()->loss_balance);
    }

    public function test_forced_loss_is_deducted_from_another_profitable_machine(): void
    {
        $this->cut([
            ['machine_id' => $this->winner->id, 'current_in' => 1100, 'current_out' => 500],   // +10.000
            ['machine_id' => $this->loser->id, 'current_in' => 1010, 'current_out' => 530, 'forced' => true], // -2.000
        ])->assertSessionHasNoErrors();

        $c = Collection::with('items')->firstOrFail();

        $this->assertSame('8000.00', $c->net);
        $this->assertSame('2400.00', $c->client_share);   // 30% de la ganancia neta, ya rebajada la pérdida.
        $this->assertSame('5600.00', $c->company_share);
        $this->assertSame('2400.00', $c->client_paid);
        $this->assertSame('5600.00', $c->cash_delivered);
        $this->assertSame([false, true], $c->items->sortBy('machine_id')->pluck('forced')->all());
        $this->assertSame('0.00', $this->client->fresh()->loss_balance);
    }

    public function test_pending_loss_is_deducted_from_the_next_profitable_cut(): void
    {
        // Corte forzado con pérdida total de ₡3.000: la pulpería asume ₡900 pendientes.
        $this->cut([['machine_id' => $this->loser->id, 'current_in' => 1000, 'current_out' => 530, 'forced' => true]])->assertSessionHasNoErrors();
        $this->assertSame('900.00', $this->client->fresh()->loss_balance);

        // Siguiente corte con ganancia de ₡5.000: comisión ₡1.500, se rebajan los ₡900.
        $this->cut([['machine_id' => $this->winner->id, 'current_in' => 1050, 'current_out' => 500]])->assertSessionHasNoErrors();

        $c = Collection::latest('id')->firstOrFail();
        $this->assertSame('1500.00', $c->client_share);
        $this->assertSame('900.00', $c->loss_offset);
        $this->assertSame('600.00', $c->client_paid);
        $this->assertSame('4400.00', $c->cash_delivered);
        $this->assertSame('0.00', $this->client->fresh()->loss_balance);
    }

    public function test_pending_loss_larger_than_commission_carries_over(): void
    {
        $this->client->update(['loss_balance' => 2000]);

        $this->cut([['machine_id' => $this->winner->id, 'current_in' => 1050, 'current_out' => 500]])->assertSessionHasNoErrors();

        $c = Collection::firstOrFail();
        $this->assertSame('1500.00', $c->loss_offset);
        $this->assertSame('0.00', $c->client_paid);
        $this->assertSame('500.00', $this->client->fresh()->loss_balance);
    }

    public function test_loan_deduction_cannot_exceed_commission_after_pending_loss(): void
    {
        $this->client->update(['loss_balance' => 1000]);
        $loan = $this->client->loans()->create([
            'office_id' => $this->client->collectionRoute->office_id,
            'user_id' => $this->collector->id,
            'principal' => 10000, 'interest_percent' => 0, 'total' => 10000, 'balance' => 10000,
            'frequency' => 'weekly', 'installments' => 4, 'installment_amount' => 2500,
            'issued_on' => now()->toDateString(), 'first_due_on' => now()->toDateString(),
        ]);

        // Comisión ₡1.500 − pendiente ₡1.000 = ₡500 disponibles para el préstamo.
        $this->cut([['machine_id' => $this->winner->id, 'current_in' => 1050, 'current_out' => 500]], ['loan_id' => $loan->id, 'loan_deduction' => 600])
            ->assertSessionHasErrors('loan_deduction');

        $this->cut([['machine_id' => $this->winner->id, 'current_in' => 1050, 'current_out' => 500]], ['loan_id' => $loan->id, 'loan_deduction' => 500])
            ->assertSessionHasNoErrors();

        $this->assertSame('0.00', Collection::firstOrFail()->client_paid);
        $this->assertSame('9500.00', $loan->fresh()->balance);
    }

    public function test_voiding_restores_pending_loss_and_only_the_latest_cut_can_be_voided(): void
    {
        $service = app(CollectionService::class);

        $first = $service->record($this->collector, $this->client, [
            'collected_on' => now()->toDateString(),
            'items' => [['machine_id' => $this->loser->id, 'current_in' => 1000, 'current_out' => 530, 'forced' => true]],
        ]);
        $second = $service->record($this->collector, $this->client->fresh(), [
            'collected_on' => now()->toDateString(),
            'items' => [['machine_id' => $this->winner->id, 'current_in' => 1050, 'current_out' => 500]],
        ]);

        $admin = User::factory()->create(['role_id' => Role::where('name', 'Administrador')->value('id')]);

        $this->actingAs($admin)->delete(route('collections.destroy', $first))->assertSessionHasErrors('collection');

        $this->actingAs($admin)->delete(route('collections.destroy', $second))->assertSessionHasNoErrors();
        $this->assertSame('900.00', $this->client->fresh()->loss_balance);

        $this->actingAs($admin)->delete(route('collections.destroy', $first))->assertSessionHasNoErrors();
        $this->assertSame('0.00', $this->client->fresh()->loss_balance);
        $this->assertSame(500, $this->loser->fresh()->counter_out);
    }

    public function test_settlement_math(): void
    {
        $this->assertSame(
            ['client_share' => 300.0, 'loss_offset' => 100.0, 'loss_added' => 0.0, 'client_earned' => 200.0, 'loss_balance' => 0.0],
            CollectionService::settle(1000, 30, 100),
        );
        $this->assertSame(
            ['client_share' => -300.0, 'loss_offset' => 0.0, 'loss_added' => 300.0, 'client_earned' => 0.0, 'loss_balance' => 400.0],
            CollectionService::settle(-1000, 30, 100),
        );
        $this->assertSame(
            ['client_share' => 0.0, 'loss_offset' => 0.0, 'loss_added' => 0.0, 'client_earned' => 0.0, 'loss_balance' => 50.0],
            CollectionService::settle(0, 30, 50),
        );
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, mixed>  $extra
     */
    private function cut(array $items, array $extra = []): TestResponse
    {
        return $this->actingAs($this->collector)->post(route('collections.store'), [
            'client_id' => $this->client->id,
            'collected_on' => now()->toDateString(),
            'items' => $items,
            ...$extra,
        ]);
    }

    private function machine(Office $office, string $code): Machine
    {
        return Machine::create([
            'office_id' => $office->id,
            'client_id' => $this->client->id,
            'code' => $code,
            'credit_value' => 100,
            'counter_in' => 1000,
            'counter_out' => 500,
            'status' => MachineStatus::Installed,
        ]);
    }
}

<?php

namespace Tests\Feature;

use App\Enums\LoanFrequency;
use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Collection;
use App\Models\CollectionRoute;
use App\Models\Loan;
use App\Models\Machine;
use App\Models\Office;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CollectionTest extends TestCase
{
    use RefreshDatabase;

    private User $collector;

    private Client $client;

    private Machine $machine;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        $office = Office::create(['code' => 'CEN', 'name' => 'Central']);

        $this->collector = User::factory()->create([
            'role_id' => Role::where('name', 'Cobrador')->value('id'),
            'office_id' => $office->id,
        ]);

        $route = CollectionRoute::create([
            'office_id' => $office->id,
            'collector_id' => $this->collector->id,
            'code' => 'R1',
            'name' => 'Ruta 1',
        ]);

        $this->client = Client::create([
            'collection_route_id' => $route->id,
            'name' => 'Tienda Uno',
            'commission_percent' => 30,
        ]);

        $this->machine = Machine::create([
            'office_id' => $office->id,
            'client_id' => $this->client->id,
            'code' => 'MAQ-1',
            'credit_value' => 10,
            'counter_in' => 1000,
            'counter_out' => 500,
            'status' => MachineStatus::Installed,
        ]);
    }

    public function test_collection_computes_shares_and_updates_counters(): void
    {
        $this->actingAs($this->collector)
            ->post(route('collections.store'), [
                'client_id' => $this->client->id,
                'collected_on' => now()->toDateString(),
                'items' => [['machine_id' => $this->machine->id, 'current_in' => 1100, 'current_out' => 550]],
            ])
            ->assertRedirect();

        $collection = Collection::firstOrFail();

        // (100 - 50) créditos × 10 = 500 de ganancia; 30% para el cliente.
        $this->assertSame('500.00', $collection->net);
        $this->assertSame('150.00', $collection->client_share);
        $this->assertSame('350.00', $collection->company_share);
        $this->assertSame('350.00', $collection->cash_delivered);
        $this->assertSame(1100, $this->machine->fresh()->counter_in);
        $this->assertSame(550, $this->machine->fresh()->counter_out);
    }

    public function test_forced_losing_collection_shares_the_loss_with_the_client(): void
    {
        $this->actingAs($this->collector)->post(route('collections.store'), [
            'client_id' => $this->client->id,
            'collected_on' => now()->toDateString(),
            'items' => [['machine_id' => $this->machine->id, 'current_in' => 1010, 'current_out' => 530, 'forced' => true]],
        ])->assertSessionHasNoErrors();

        $collection = Collection::firstOrFail();

        // Pérdida de 200: la pulpería (30%) asume 60 que quedan pendientes; la oficina cubre el efectivo.
        $this->assertSame('-200.00', $collection->net);
        $this->assertSame('-60.00', $collection->client_share);
        $this->assertSame('-140.00', $collection->company_share);
        $this->assertSame('60.00', $collection->loss_added);
        $this->assertSame('0.00', $collection->client_paid);
        $this->assertSame('-200.00', $collection->cash_delivered);
        $this->assertSame('60.00', $this->client->fresh()->loss_balance);
    }

    public function test_counters_cannot_go_backwards(): void
    {
        $this->actingAs($this->collector)
            ->post(route('collections.store'), [
                'client_id' => $this->client->id,
                'collected_on' => now()->toDateString(),
                'items' => [['machine_id' => $this->machine->id, 'current_in' => 900, 'current_out' => 550]],
            ])
            ->assertSessionHasErrors('items.0.current_in');

        $this->assertSame(0, Collection::count());
    }

    public function test_loan_deduction_reduces_balance_and_void_restores_everything(): void
    {
        $loan = Loan::create([
            'office_id' => $this->client->collectionRoute->office_id,
            'client_id' => $this->client->id,
            'user_id' => $this->collector->id,
            'principal' => 1000,
            'interest_percent' => 20,
            'total' => 1200,
            'balance' => 1200,
            'frequency' => LoanFrequency::Weekly,
            'installments' => 8,
            'installment_amount' => 150,
            'issued_on' => now()->subWeek(),
            'first_due_on' => now(),
        ]);

        $this->actingAs($this->collector)->post(route('collections.store'), [
            'client_id' => $this->client->id,
            'collected_on' => now()->toDateString(),
            'loan_id' => $loan->id,
            'loan_deduction' => 100,
            'items' => [['machine_id' => $this->machine->id, 'current_in' => 1100, 'current_out' => 550]],
        ])->assertSessionHasNoErrors();

        $collection = Collection::firstOrFail();
        $this->assertSame('450.00', $collection->cash_delivered);
        $this->assertSame('1100.00', $loan->fresh()->balance);

        $admin = User::factory()->create(['role_id' => Role::where('name', 'Administrador')->value('id')]);

        $this->actingAs($admin)->delete(route('collections.destroy', $collection))->assertRedirect();

        $this->assertSame(0, Collection::count());
        $this->assertSame('1200.00', $loan->fresh()->balance);
        $this->assertSame(1000, $this->machine->fresh()->counter_in);
    }

    public function test_collector_cannot_void_collections_or_see_other_routes(): void
    {
        $other = User::factory()->create([
            'role_id' => Role::where('name', 'Cobrador')->value('id'),
            'office_id' => $this->collector->office_id,
        ]);

        $this->actingAs($other)->get(route('clients.show', $this->client))->assertNotFound();
        $this->actingAs($this->collector)->get(route('clients.show', $this->client))->assertOk();
        $this->actingAs($this->collector)->get(route('offices.index'))->assertForbidden();
    }
}

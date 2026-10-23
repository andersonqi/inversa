<?php

namespace Tests\Feature;

use App\Enums\MachineMovementType;
use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Machine;
use App\Models\MachineMovement;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class MachineMovementTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    private Client $neighbor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();

        // Tras el corte de BuildsOperation, MAQ-1 quedó en 1100 / 550.
        $this->neighbor = Client::create(['collection_route_id' => $this->route->id, 'name' => 'Tienda Vecina', 'commission_percent' => 30]);
    }

    public function test_supervisor_transfers_a_machine_and_history_is_saved(): void
    {
        $this->actingAs($this->supervisor)
            ->from(route('machines.show', $this->machine))
            ->post(route('machines.transfer', $this->machine), [
                'client_id' => $this->neighbor->id,
                'counter_in' => 1100,
                'counter_out' => 550,
                'reason' => 'Mejor ubicación',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('machines.show', $this->machine));

        $machine = $this->machine->fresh();
        $this->assertSame($this->neighbor->id, $machine?->client_id);
        $this->assertSame(MachineStatus::Installed, $machine?->status);

        $movement = MachineMovement::firstOrFail();
        $this->assertSame(MachineMovementType::Transfer, $movement->type);
        $this->assertSame($this->client->id, $movement->from_client_id);
        $this->assertSame($this->neighbor->id, $movement->to_client_id);
        $this->assertSame($this->supervisor->id, $movement->user_id);
        $this->assertSame('Mejor ubicación', $movement->reason);

        $this->actingAs($this->supervisor)->get(route('machines.show', $this->machine))
            ->assertInertia(fn (Assert $page) => $page
                ->has('movements', 1)
                ->where('movements.0.from_client.name', 'Abarrotería Uno')
                ->where('movements.0.to_client.name', 'Tienda Vecina'));
    }

    public function test_machine_with_uncollected_plays_cannot_be_moved(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('machines.transfer', $this->machine), [
                'client_id' => $this->neighbor->id,
                'counter_in' => 1180,
                'counter_out' => 550,
                'reason' => 'Mejor ubicación',
            ])
            ->assertSessionHasErrors('counter_in');

        $this->actingAs($this->supervisor)
            ->post(route('machines.warehouse', $this->machine), [
                'counter_in' => 1100,
                'counter_out' => 540,
                'reason' => 'Falla',
            ])
            ->assertSessionHasErrors('counter_out');

        $this->assertSame($this->client->id, $this->machine->fresh()?->client_id);
        $this->assertSame(0, MachineMovement::count());
    }

    public function test_transfer_requires_reason_and_a_client_of_the_same_office(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('machines.transfer', $this->machine), [
                'client_id' => $this->neighbor->id,
                'counter_in' => 1100,
                'counter_out' => 550,
                'reason' => '',
            ])
            ->assertSessionHasErrors('reason');

        // El supervisor no ve clientes de otra oficina.
        $this->actingAs($this->supervisor)
            ->post(route('machines.transfer', $this->machine), [
                'client_id' => $this->otherClient->id,
                'counter_in' => 1100,
                'counter_out' => 550,
                'reason' => 'Prueba',
            ])
            ->assertSessionHasErrors('client_id');

        // El administrador los ve, pero la máquina pertenece a otra oficina.
        $this->actingAs($this->admin)
            ->post(route('machines.transfer', $this->machine), [
                'client_id' => $this->otherClient->id,
                'counter_in' => 1100,
                'counter_out' => 550,
                'reason' => 'Prueba',
            ])
            ->assertSessionHasErrors('client_id');

        $this->assertSame($this->client->id, $this->machine->fresh()?->client_id);
    }

    public function test_machine_is_sent_to_warehouse_and_installed_again(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('machines.warehouse', $this->machine), [
                'counter_in' => 1100,
                'counter_out' => 550,
                'reason' => 'Falla de pantalla',
            ])
            ->assertSessionHasNoErrors();

        $machine = $this->machine->fresh();
        $this->assertNull($machine?->client_id);
        $this->assertSame(MachineStatus::Warehouse, $machine?->status);

        // Al instalar, los contadores leídos quedan como base del próximo corte.
        $this->actingAs($this->supervisor)
            ->post(route('machines.install', $this->machine), [
                'client_id' => $this->neighbor->id,
                'counter_in' => 1250,
                'counter_out' => 600,
            ])
            ->assertSessionHasNoErrors();

        $machine = $this->machine->fresh();
        $this->assertSame($this->neighbor->id, $machine?->client_id);
        $this->assertSame(MachineStatus::Installed, $machine?->status);
        $this->assertSame(1250, $machine?->counter_in);
        $this->assertSame(600, $machine?->counter_out);

        $this->assertSame(
            [MachineMovementType::Warehouse, MachineMovementType::Install],
            MachineMovement::orderBy('id')->get()->pluck('type')->all(),
        );
    }

    public function test_only_warehouse_or_maintenance_machines_can_be_installed(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('machines.install', $this->machine), [
                'client_id' => $this->neighbor->id,
                'counter_in' => 1100,
                'counter_out' => 550,
            ])
            ->assertSessionHasErrors('client_id');

        $retired = Machine::create([
            'office_id' => $this->office->id,
            'code' => 'MAQ-BAJA',
            'credit_value' => 100,
            'status' => MachineStatus::Retired,
        ]);

        $this->actingAs($this->supervisor)
            ->post(route('machines.install', $retired), [
                'client_id' => $this->neighbor->id,
                'counter_in' => 0,
                'counter_out' => 0,
            ])
            ->assertSessionHasErrors('client_id');
    }

    public function test_collector_needs_the_permission_and_only_moves_within_own_route(): void
    {
        $payload = [
            'client_id' => $this->neighbor->id,
            'counter_in' => 1100,
            'counter_out' => 550,
            'reason' => 'Pedido del cliente',
        ];

        $this->actingAs($this->collector)
            ->post(route('machines.transfer', $this->machine), $payload)
            ->assertForbidden();

        $role = Role::where('name', 'Cobrador')->firstOrFail();
        $role->update(['permissions' => [...$role->permissions, 'machines.move']]);
        $this->collector->refresh();

        // No puede mover máquinas de otras rutas.
        $this->actingAs($this->collector)
            ->post(route('machines.warehouse', $this->otherMachine), ['counter_in' => 1010, 'counter_out' => 530, 'reason' => 'x'])
            ->assertNotFound();

        $this->actingAs($this->collector)
            ->post(route('machines.transfer', $this->machine), $payload)
            ->assertSessionHasNoErrors();

        $this->assertSame($this->neighbor->id, $this->machine->fresh()?->client_id);
    }

    public function test_move_destinations_are_only_sent_to_users_with_permission(): void
    {
        $this->actingAs($this->supervisor)->get(route('machines.show', $this->machine))
            ->assertInertia(fn (Assert $page) => $page->has('moveClients', 2));

        $this->actingAs($this->collector)->get(route('machines.show', $this->machine))
            ->assertInertia(fn (Assert $page) => $page->has('moveClients', 0));
    }
}

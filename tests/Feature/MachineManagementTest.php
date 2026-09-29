<?php

namespace Tests\Feature;

use App\Enums\MachineStatus;
use App\Models\Machine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class MachineManagementTest extends TestCase
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
            'client_id' => null,
            'code' => 'MAQ-9',
            'serial' => 'SN-001',
            'brand' => 'Novomatic',
            'model' => 'X1',
            'credit_value' => 25,
            'counter_in' => 200,
            'counter_out' => 100,
            'purchase_cost' => 1500000,
            'status' => 'warehouse',
            ...$overrides,
        ];
    }

    /**
     * Máquina de CEN sin lecturas, instalada en el cliente de la operación.
     */
    private function freshMachine(): Machine
    {
        return $this->installMachine($this->client, 'MAQ-NEW', 10);
    }

    public function test_admin_creates_machine_in_warehouse(): void
    {
        $response = $this->actingAs($this->admin)
            ->post(route('machines.store'), $this->payload(['client_id' => $this->client->id]))
            ->assertSessionHasNoErrors();

        $machine = Machine::where('code', 'MAQ-9')->firstOrFail();
        $response->assertRedirect(route('machines.show', $machine));

        $this->assertSame(MachineStatus::Warehouse, $machine->status);
        // En bodega no queda asignada a ningún cliente aunque se envíe.
        $this->assertNull($machine->client_id);
        $this->assertSame('25.00', $machine->credit_value);
        $this->assertSame(200, $machine->counter_in);
        $this->assertSame(100, $machine->counter_out);
    }

    public function test_counters_default_to_zero(): void
    {
        $this->actingAs($this->admin)
            ->post(route('machines.store'), $this->payload(['counter_in' => null, 'counter_out' => null]))
            ->assertSessionHasNoErrors();

        $machine = Machine::where('code', 'MAQ-9')->firstOrFail();
        $this->assertSame(0, $machine->counter_in);
        $this->assertSame(0, $machine->counter_out);
    }

    public function test_installing_requires_client(): void
    {
        $this->actingAs($this->admin)
            ->post(route('machines.store'), $this->payload(['status' => 'installed']))
            ->assertSessionHasErrors('client_id');

        $this->assertDatabaseMissing('machines', ['code' => 'MAQ-9']);
    }

    public function test_installing_sets_client_and_default_install_date(): void
    {
        $this->actingAs($this->admin)
            ->post(route('machines.store'), $this->payload(['status' => 'installed', 'client_id' => $this->client->id]))
            ->assertSessionHasNoErrors();

        $machine = Machine::where('code', 'MAQ-9')->firstOrFail();
        $this->assertSame($this->client->id, $machine->client_id);
        $this->assertSame(MachineStatus::Installed, $machine->status);
        $this->assertNotNull($machine->installed_at);
    }

    public function test_installed_client_must_belong_to_machine_office(): void
    {
        $this->actingAs($this->admin)
            ->post(route('machines.store'), $this->payload(['status' => 'installed', 'client_id' => $this->otherClient->id]))
            ->assertSessionHasErrors('client_id');

        $this->assertDatabaseMissing('machines', ['code' => 'MAQ-9']);
    }

    public function test_supervisor_cannot_create_machine_in_other_office(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('machines.store'), $this->payload(['office_id' => $this->otherOffice->id]))
            ->assertForbidden();

        $this->actingAs($this->supervisor)
            ->put(route('machines.update', $this->otherMachine), $this->payload(['code' => 'MAQ-2']))
            ->assertNotFound();

        $this->assertDatabaseMissing('machines', ['code' => 'MAQ-9']);
    }

    public function test_status_other_than_installed_clears_client(): void
    {
        $machine = $this->freshMachine();

        $this->actingAs($this->admin)
            ->put(route('machines.update', $machine), $this->payload([
                'code' => 'MAQ-NEW',
                'status' => 'maintenance',
                'client_id' => $this->client->id,
            ]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('machines.show', $machine));

        $machine->refresh();
        $this->assertSame(MachineStatus::Maintenance, $machine->status);
        $this->assertNull($machine->client_id);
    }

    public function test_counters_are_editable_while_machine_has_no_readings(): void
    {
        $machine = $this->freshMachine();

        $this->actingAs($this->admin)
            ->put(route('machines.update', $machine), $this->payload([
                'code' => 'MAQ-NEW',
                'status' => 'installed',
                'client_id' => $this->client->id,
                'counter_in' => 5000,
                'counter_out' => 2500,
                'credit_value' => 50,
            ]))
            ->assertSessionHasNoErrors();

        $machine->refresh();
        $this->assertSame(5000, $machine->counter_in);
        $this->assertSame(2500, $machine->counter_out);
        $this->assertSame('50.00', $machine->credit_value);
    }

    public function test_counters_and_credit_value_are_locked_once_machine_has_readings(): void
    {
        // $this->machine ya tiene un corte: contadores 1100/550 y valor de crédito 100.
        $this->actingAs($this->admin)
            ->put(route('machines.update', $this->machine), $this->payload([
                'code' => 'MAQ-1',
                'brand' => 'Otra marca',
                'status' => 'installed',
                'client_id' => $this->client->id,
                'counter_in' => 1,
                'counter_out' => 1,
                'credit_value' => 999,
            ]))
            ->assertSessionHasNoErrors();

        $machine = $this->machine->fresh();
        $this->assertSame('Otra marca', $machine->brand);
        $this->assertSame(1100, $machine->counter_in);
        $this->assertSame(550, $machine->counter_out);
        $this->assertSame('100.00', $machine->credit_value);
    }

    public function test_machine_with_readings_cannot_be_deleted(): void
    {
        $this->actingAs($this->admin)
            ->from(route('machines.show', $this->machine))
            ->delete(route('machines.destroy', $this->machine))
            ->assertRedirect(route('machines.show', $this->machine))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertModelExists($this->machine);
    }

    public function test_machine_without_readings_can_be_deleted(): void
    {
        $machine = $this->freshMachine();

        $this->actingAs($this->admin)
            ->delete(route('machines.destroy', $machine))
            ->assertRedirect(route('machines.index'));

        $this->assertModelMissing($machine);
    }

    public function test_code_must_be_unique(): void
    {
        $this->actingAs($this->admin)
            ->post(route('machines.store'), $this->payload(['code' => 'MAQ-2']))
            ->assertSessionHasErrors('code');

        // Editar conservando su propio código es válido.
        $machine = $this->freshMachine();
        $this->actingAs($this->admin)
            ->put(route('machines.update', $machine), $this->payload(['code' => 'MAQ-NEW']))
            ->assertSessionHasNoErrors();
    }

    public function test_credit_value_must_be_positive(): void
    {
        $this->actingAs($this->admin)
            ->post(route('machines.store'), $this->payload(['credit_value' => 0]))
            ->assertSessionHasErrors('credit_value');
    }

    public function test_collector_can_view_but_not_manage_machines(): void
    {
        $this->actingAs($this->collector)->get(route('machines.show', $this->machine))->assertOk();
        $this->actingAs($this->collector)->get(route('machines.show', $this->otherMachine))->assertNotFound();
        $this->actingAs($this->collector)->post(route('machines.store'), $this->payload())->assertForbidden();
        $this->actingAs($this->collector)->delete(route('machines.destroy', $this->machine))->assertForbidden();
    }
}

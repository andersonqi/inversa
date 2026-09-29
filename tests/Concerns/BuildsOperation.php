<?php

namespace Tests\Concerns;

use App\Enums\ExpenseCategory;
use App\Enums\LoanFrequency;
use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Collection;
use App\Models\CollectionRoute;
use App\Models\Expense;
use App\Models\Loan;
use App\Models\Machine;
use App\Models\Office;
use App\Models\Role;
use App\Models\User;
use App\Services\CollectionService;
use Database\Seeders\RoleSeeder;

/**
 * Arma una operación mínima con dos oficinas para probar permisos, alcance y cálculos:
 * cada oficina tiene supervisor, cobrador, una ruta, un cliente con una máquina, un corte,
 * un préstamo y un gasto. El corte de Norte es forzado con pérdida de ₡1.000: la pulpería
 * (40%) asume ₡400 como pérdida pendiente y la empresa -₡600.
 */
trait BuildsOperation
{
    protected User $admin;

    protected User $supervisor;

    protected User $collector;

    protected Office $office;

    protected Office $otherOffice;

    protected CollectionRoute $route;

    protected CollectionRoute $otherRoute;

    protected Client $client;

    protected Client $otherClient;

    protected Machine $machine;

    protected Machine $otherMachine;

    protected Collection $collection;

    protected Loan $loan;

    protected Expense $expense;

    protected function buildOperation(): void
    {
        $this->seed(RoleSeeder::class);

        $this->admin = User::factory()->create(['role_id' => $this->roleId('Administrador')]);

        $this->office = Office::create(['code' => 'CEN', 'name' => 'Central', 'city' => 'Guatemala']);
        $this->otherOffice = Office::create(['code' => 'NOR', 'name' => 'Norte', 'city' => 'Cobán']);

        $this->supervisor = User::factory()->create(['role_id' => $this->roleId('Supervisor'), 'office_id' => $this->office->id]);
        $this->collector = User::factory()->create(['role_id' => $this->roleId('Cobrador'), 'office_id' => $this->office->id]);
        $otherCollector = User::factory()->create(['role_id' => $this->roleId('Cobrador'), 'office_id' => $this->otherOffice->id]);

        $this->route = CollectionRoute::create(['office_id' => $this->office->id, 'collector_id' => $this->collector->id, 'code' => 'R1', 'name' => 'Ruta Centro']);
        $this->otherRoute = CollectionRoute::create(['office_id' => $this->otherOffice->id, 'collector_id' => $otherCollector->id, 'code' => 'R1', 'name' => 'Ruta Norte']);

        $this->client = Client::create(['collection_route_id' => $this->route->id, 'name' => 'Abarrotería Uno', 'commission_percent' => 30]);
        $this->otherClient = Client::create(['collection_route_id' => $this->otherRoute->id, 'name' => 'Tienda Norte', 'commission_percent' => 40]);

        $this->machine = $this->installMachine($this->client, 'MAQ-1', 100);
        $this->otherMachine = $this->installMachine($this->otherClient, 'MAQ-2', 50);

        $service = app(CollectionService::class);

        $this->collection = $service->record($this->collector, $this->client, [
            'collected_on' => now()->toDateString(),
            'items' => [['machine_id' => $this->machine->id, 'current_in' => 1100, 'current_out' => 550]],
        ]);

        $service->record($otherCollector, $this->otherClient, [
            'collected_on' => now()->toDateString(),
            // Máquina perdedora cortada a la fuerza: pagó más de lo que recibió.
            'items' => [['machine_id' => $this->otherMachine->id, 'current_in' => 1010, 'current_out' => 530, 'forced' => true]],
        ]);

        $this->loan = Loan::create([
            'office_id' => $this->office->id,
            'client_id' => $this->client->id,
            'user_id' => $this->admin->id,
            'principal' => 100000,
            'interest_percent' => 20,
            'total' => 120000,
            'balance' => 120000,
            'frequency' => LoanFrequency::Weekly,
            'installments' => 8,
            'installment_amount' => 15000,
            'issued_on' => now()->subWeeks(3)->toDateString(),
            'first_due_on' => now()->subWeeks(2)->toDateString(),
        ]);

        $this->expense = Expense::create([
            'office_id' => $this->office->id,
            'collection_route_id' => $this->route->id,
            'user_id' => $this->collector->id,
            'category' => ExpenseCategory::Fuel,
            'amount' => 5000,
            'spent_on' => now()->toDateString(),
            'description' => 'Gasolina',
        ]);

        Expense::create([
            'office_id' => $this->otherOffice->id,
            'user_id' => $otherCollector->id,
            'category' => ExpenseCategory::Rent,
            'amount' => 80000,
            'spent_on' => now()->toDateString(),
        ]);
    }

    protected function roleId(string $name): int
    {
        return (int) Role::where('name', $name)->value('id');
    }

    protected function installMachine(Client $client, string $code, float $creditValue): Machine
    {
        return Machine::create([
            'office_id' => $client->collectionRoute->office_id,
            'client_id' => $client->id,
            'code' => $code,
            'credit_value' => $creditValue,
            'counter_in' => 1000,
            'counter_out' => 500,
            'status' => MachineStatus::Installed,
        ]);
    }
}

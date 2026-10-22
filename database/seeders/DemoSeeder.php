<?php

namespace Database\Seeders;

use App\Enums\ExpenseCategory;
use App\Enums\LoanFrequency;
use App\Enums\LoanStatus;
use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\CollectionRoute;
use App\Models\Expense;
use App\Models\Loan;
use App\Models\Machine;
use App\Models\Office;
use App\Models\Role;
use App\Models\User;
use App\Services\CollectionService;
use Illuminate\Database\Seeder;

/**
 * Datos de demostración: oficinas, rutas, clientes, máquinas y 30 días de cortes.
 */
class DemoSeeder extends Seeder
{
    public function run(CollectionService $service): void
    {
        $supervisorRole = Role::where('name', 'Supervisor')->firstOrFail();
        $collectorRole = Role::where('name', 'Cobrador')->firstOrFail();
        $admin = User::where('email', 'admin@inversa.test')->firstOrFail();

        $offices = [
            Office::create(['code' => 'CEN', 'name' => 'Oficina Central', 'city' => 'Ciudad Principal', 'phone' => '555-0100']),
            Office::create(['code' => 'NOR', 'name' => 'Oficina Norte', 'city' => 'Zona Norte', 'phone' => '555-0200']),
        ];

        $machineNumber = 1;

        foreach ($offices as $o => $office) {
            User::create([
                'name' => "Supervisor {$office->name}",
                'email' => 'supervisor'.($o + 1).'@inversa.test',
                'password' => 'password',
                'role_id' => $supervisorRole->id,
                'office_id' => $office->id,
                'email_verified_at' => now(),
            ]);

            for ($r = 1; $r <= 2; $r++) {
                $collector = User::create([
                    'name' => fake()->name(),
                    'email' => "cobrador{$office->code}{$r}@inversa.test",
                    'password' => 'password',
                    'role_id' => $collectorRole->id,
                    'office_id' => $office->id,
                    'email_verified_at' => now(),
                ]);

                $route = CollectionRoute::create([
                    'office_id' => $office->id,
                    'collector_id' => $collector->id,
                    'code' => "{$office->code}-R{$r}",
                    'name' => fake()->streetName(),
                ]);

                for ($c = 1; $c <= 5; $c++) {
                    $client = Client::create([
                        'collection_route_id' => $route->id,
                        'name' => fake()->name(),
                        'business_name' => 'Tienda '.fake()->lastName(),
                        'document' => (string) fake()->numerify('#########'),
                        'phone' => fake()->numerify('555-####'),
                        'address' => fake()->streetAddress(),
                        'commission_percent' => fake()->randomElement([25, 30, 35, 40]),
                        'visit_order' => $c,
                        'visit_day' => (($r + $c) % 6) + 1,
                    ]);

                    for ($m = 0; $m < fake()->numberBetween(1, 3); $m++) {
                        $counterIn = fake()->numberBetween(1000, 50000);

                        Machine::create([
                            'office_id' => $office->id,
                            'client_id' => $client->id,
                            'code' => sprintf('MAQ-%04d', $machineNumber++),
                            'serial' => strtoupper(fake()->bothify('??####')),
                            'brand' => fake()->randomElement(['Aristocrat', 'IGT', 'Novomatic', 'Genérica']),
                            'model' => fake()->randomElement(['Fruit 5', 'Dragon Link', 'Lucky 7']),
                            'credit_value' => fake()->randomElement([25, 50, 100]),
                            'counter_in' => $counterIn,
                            'counter_out' => (int) ($counterIn * 0.7),
                            'installed_at' => now()->subDays(60),
                            'status' => MachineStatus::Installed,
                        ]);
                    }

                    if ($c === 2) {
                        Loan::create([
                            'office_id' => $office->id,
                            'client_id' => $client->id,
                            'user_id' => $admin->id,
                            'principal' => 150000,
                            'interest_percent' => 20,
                            'total' => 180000,
                            'balance' => 180000,
                            'frequency' => LoanFrequency::Weekly,
                            'installments' => 8,
                            'installment_amount' => 22500,
                            'issued_on' => now()->subDays(35),
                            'first_due_on' => now()->subDays(28),
                            'status' => LoanStatus::Active,
                        ]);
                    }
                }

                $this->simulateVisits($service, $route, $collector);
            }

            for ($d = 0; $d < 10; $d++) {
                Expense::create([
                    'office_id' => $office->id,
                    'collection_route_id' => $office->routes()->inRandomOrder()->value('id'),
                    'user_id' => $admin->id,
                    'category' => fake()->randomElement(ExpenseCategory::cases()),
                    'amount' => fake()->randomFloat(0, 5000, 60000),
                    'spent_on' => now()->subDays(fake()->numberBetween(0, 29)),
                    'description' => fake()->sentence(4),
                ]);
            }
        }
    }

    /**
     * Visitas semanales durante los últimos 30 días.
     */
    private function simulateVisits(CollectionService $service, CollectionRoute $route, User $collector): void
    {
        $clients = $route->clients()->get();

        foreach ([28, 21, 14, 7, 0] as $daysAgo) {
            foreach ($clients as $client) {
                $items = [];

                foreach ($client->machines()->get() as $machine) {
                    $played = fake()->numberBetween(200, 2500);
                    // Algunas máquinas pagan más de lo que reciben (máquinas perdedoras).
                    $payout = $machine->id % 7 === 0 ? fake()->randomFloat(2, 1.05, 1.4) : fake()->randomFloat(2, 0.55, 0.9);

                    // Regla: una máquina en pérdida espera a que recupere; en la última visita se corta forzada.
                    if ($payout > 1 && $daysAgo > 0) {
                        continue;
                    }

                    $items[] = [
                        'machine_id' => $machine->id,
                        'current_in' => $machine->counter_in + $played,
                        'current_out' => $machine->counter_out + (int) ($played * $payout),
                        'forced' => $payout > 1,
                    ];
                }

                if ($items === []) {
                    continue;
                }

                $loan = $client->activeLoans()->first();

                $service->record($collector, $client->fresh(), [
                    'collected_on' => now()->subDays($daysAgo)->toDateString(),
                    'items' => $items,
                    'loan_id' => $loan?->id,
                    'loan_deduction' => 0,
                ]);

                if ($loan) {
                    $loan->payments()->create([
                        'user_id' => $collector->id,
                        'amount' => min(22500, (float) $loan->fresh()->balance),
                        'paid_on' => now()->subDays($daysAgo)->toDateString(),
                    ]);
                    $loan->refreshBalance();
                }
            }
        }
    }
}

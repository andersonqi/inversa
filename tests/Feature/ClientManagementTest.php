<?php

namespace Tests\Feature;

use App\Enums\RoleScope;
use App\Models\Client;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class ClientManagementTest extends TestCase
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
            'collection_route_id' => $this->route->id,
            'name' => 'Tienda Nueva',
            'business_name' => 'Comercial Nueva, S.A.',
            'document' => '1234567-8',
            'phone' => '3333-3333',
            'address' => 'Zona 1',
            'commission_percent' => 35,
            'visit_order' => '',
            'notes' => null,
            'is_active' => '1',
            ...$overrides,
        ];
    }

    public function test_admin_creates_a_client_and_is_redirected_to_show(): void
    {
        $response = $this->actingAs($this->admin)
            ->post(route('clients.store'), $this->payload())
            ->assertSessionHasNoErrors();

        $client = Client::where('name', 'Tienda Nueva')->firstOrFail();
        $response->assertRedirect(route('clients.show', $client));

        $this->assertSame($this->route->id, $client->collection_route_id);
        $this->assertSame('35.00', $client->commission_percent);
        $this->assertSame(0, $client->visit_order);
        $this->assertTrue($client->is_active);
    }

    public function test_admin_updates_a_client(): void
    {
        $this->actingAs($this->admin)
            ->put(route('clients.update', $this->client), $this->payload([
                'name' => 'Abarrotería Uno Renovada',
                'commission_percent' => '42.5',
                'visit_order' => 3,
                'is_active' => '0',
            ]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('clients.show', $this->client));

        $client = $this->client->fresh();
        $this->assertSame('Abarrotería Uno Renovada', $client->name);
        $this->assertSame('42.50', $client->commission_percent);
        $this->assertSame(3, $client->visit_order);
        $this->assertFalse($client->is_active);
    }

    public function test_commission_percent_must_be_between_0_and_100(): void
    {
        foreach ([-1, 100.01, 150, ''] as $invalid) {
            $this->actingAs($this->admin)
                ->post(route('clients.store'), $this->payload(['commission_percent' => $invalid]))
                ->assertSessionHasErrors('commission_percent');
        }

        $this->assertDatabaseMissing('clients', ['name' => 'Tienda Nueva']);

        foreach ([0, 100] as $valid) {
            $this->actingAs($this->admin)
                ->post(route('clients.store'), $this->payload(['name' => "Límite {$valid}", 'commission_percent' => $valid]))
                ->assertSessionHasNoErrors();
        }
    }

    public function test_client_requires_route_and_name(): void
    {
        $this->actingAs($this->admin)
            ->post(route('clients.store'), $this->payload(['collection_route_id' => null, 'name' => '']))
            ->assertSessionHasErrors(['collection_route_id', 'name']);
    }

    public function test_supervisor_cannot_use_route_from_other_office(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('clients.store'), $this->payload(['collection_route_id' => $this->otherRoute->id]))
            ->assertForbidden();

        $this->assertDatabaseMissing('clients', ['name' => 'Tienda Nueva']);

        // Tampoco puede mover un cliente propio a una ruta ajena.
        $this->actingAs($this->supervisor)
            ->put(route('clients.update', $this->client), $this->payload(['collection_route_id' => $this->otherRoute->id]))
            ->assertForbidden();

        $this->assertSame($this->route->id, $this->client->fresh()?->collection_route_id);
    }

    public function test_supervisor_cannot_touch_clients_of_other_office(): void
    {
        $this->actingAs($this->supervisor)
            ->put(route('clients.update', $this->otherClient), $this->payload(['collection_route_id' => $this->route->id]))
            ->assertNotFound();

        $this->actingAs($this->supervisor)->get(route('clients.show', $this->otherClient))->assertNotFound();

        $this->assertSame($this->otherRoute->id, $this->otherClient->fresh()?->collection_route_id);
    }

    public function test_client_with_machines_or_collections_cannot_be_deleted(): void
    {
        $this->actingAs($this->admin)
            ->from(route('clients.show', $this->client))
            ->delete(route('clients.destroy', $this->client))
            ->assertRedirect(route('clients.show', $this->client))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertModelExists($this->client);
    }

    public function test_client_with_only_a_loan_cannot_be_deleted(): void
    {
        $client = Client::create(['collection_route_id' => $this->route->id, 'name' => 'Solo préstamo', 'commission_percent' => 10]);
        $this->loan->update(['client_id' => $client->id]);

        $this->actingAs($this->admin)
            ->delete(route('clients.destroy', $client))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertModelExists($client);
    }

    public function test_empty_client_can_be_deleted(): void
    {
        $client = Client::create(['collection_route_id' => $this->route->id, 'name' => 'Sin movimientos', 'commission_percent' => 10]);

        $this->actingAs($this->admin)
            ->delete(route('clients.destroy', $client))
            ->assertRedirect(route('clients.index'));

        $this->assertModelMissing($client);
    }

    public function test_client_stores_visit_day_and_coordinates(): void
    {
        $this->actingAs($this->admin)
            ->post(route('clients.store'), $this->payload(['visit_day' => 3, 'latitude' => '14.6349150', 'longitude' => '-90.5068824']))
            ->assertSessionHasNoErrors();

        $client = Client::where('name', 'Tienda Nueva')->firstOrFail();
        $this->assertSame(3, $client->visit_day);
        $this->assertSame('14.6349150', $client->latitude);
        $this->assertSame('-90.5068824', $client->longitude);

        $this->actingAs($this->admin)
            ->post(route('clients.store'), $this->payload(['name' => 'Día inválido', 'visit_day' => 8, 'latitude' => 14.6]))
            ->assertSessionHasErrors(['visit_day', 'longitude']);
    }

    public function test_route_view_shows_cycle_status_and_receipt_of_the_week(): void
    {
        $this->actingAs($this->collector)->get(route('clients.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('clients/index')
                ->has('clients.data', 1)
                ->where('clients.data.0.installed_machines_count', fn ($n) => (int) $n === 1)
                ->where('clients.data.0.collected_machines_count', fn ($n) => (int) $n === 1)
                ->where('clients.data.0.week_collection_id', fn ($id) => (int) $id === $this->collection->id)
                ->has('clients.data.0.machines', 1)
                ->where('today', now()->dayOfWeekIso));

        // Una máquina nueva sin cobrar deja el corte de la semana como parcial.
        $this->installMachine($this->client, 'MAQ-3', 100);

        $this->actingAs($this->collector)->get(route('clients.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('clients.data.0.installed_machines_count', fn ($n) => (int) $n === 2)
                ->where('clients.data.0.collected_machines_count', fn ($n) => (int) $n === 1));
    }

    public function test_route_view_filters_by_visit_day(): void
    {
        $this->client->update(['visit_day' => 2]);

        $this->actingAs($this->admin)->get(route('clients.index', ['day' => 2]))
            ->assertInertia(fn (Assert $page) => $page
                ->has('clients.data', 1)
                ->where('clients.data.0.id', $this->client->id)
                ->where('filters.day', '2'));

        $this->actingAs($this->admin)->get(route('clients.index', ['day' => 3]))
            ->assertInertia(fn (Assert $page) => $page->has('clients.data', 0));
    }

    public function test_collector_updates_location_of_own_clients_only(): void
    {
        $this->actingAs($this->collector)
            ->post(route('clients.location', $this->client), ['latitude' => 14.6349, 'longitude' => -90.5069])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $client = $this->client->fresh();
        $this->assertSame('14.6349000', $client?->latitude);
        $this->assertSame('-90.5069000', $client?->longitude);

        $this->actingAs($this->collector)
            ->post(route('clients.location', $this->client), ['latitude' => 200, 'longitude' => -90.5])
            ->assertSessionHasErrors('latitude');

        $this->actingAs($this->collector)
            ->post(route('clients.location', $this->otherClient), ['latitude' => 14.6, 'longitude' => -90.5])
            ->assertNotFound();

        $readOnly = User::factory()->create([
            'role_id' => Role::create(['name' => 'Consulta', 'scope' => RoleScope::All, 'permissions' => ['clients.view']])->id,
        ]);

        $this->actingAs($readOnly)
            ->post(route('clients.location', $this->client), ['latitude' => 14.6, 'longitude' => -90.5])
            ->assertForbidden();
    }

    public function test_collector_can_view_own_clients_but_not_create(): void
    {
        $this->actingAs($this->collector)
            ->post(route('clients.store'), $this->payload())
            ->assertForbidden();

        $this->actingAs($this->collector)
            ->put(route('clients.update', $this->client), $this->payload())
            ->assertForbidden();

        $this->actingAs($this->collector)->get(route('clients.show', $this->client))->assertOk();
        $this->actingAs($this->collector)->get(route('clients.show', $this->otherClient))->assertNotFound();

        $this->assertDatabaseMissing('clients', ['name' => 'Tienda Nueva']);
    }
}

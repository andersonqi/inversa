<?php

namespace Tests\Feature;

use App\Models\Client;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

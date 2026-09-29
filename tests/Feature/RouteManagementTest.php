<?php

namespace Tests\Feature;

use App\Models\CollectionRoute;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class RouteManagementTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    public function test_admin_creates_a_route(): void
    {
        $this->actingAs($this->admin)
            ->post(route('routes.store'), [
                'office_id' => $this->office->id,
                'collector_id' => $this->collector->id,
                'code' => 'R2',
                'name' => 'Ruta Sur',
                'is_active' => '1',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('routes.index'))
            ->assertInertiaFlash('toast.type', 'success');

        $route = CollectionRoute::where('office_id', $this->office->id)->where('code', 'R2')->firstOrFail();
        $this->assertSame('Ruta Sur', $route->name);
        $this->assertSame($this->collector->id, $route->collector_id);
        $this->assertTrue($route->is_active);
    }

    public function test_admin_updates_a_route(): void
    {
        $this->actingAs($this->admin)
            ->put(route('routes.update', $this->route), [
                'office_id' => $this->office->id,
                'collector_id' => null,
                'code' => 'R1',
                'name' => 'Ruta Centro 2',
                'is_active' => '0',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('routes.index'));

        $route = $this->route->fresh();
        $this->assertSame('Ruta Centro 2', $route->name);
        $this->assertNull($route->collector_id);
        $this->assertFalse($route->is_active);
    }

    public function test_code_is_unique_per_office(): void
    {
        $this->actingAs($this->admin)
            ->post(route('routes.store'), ['office_id' => $this->office->id, 'code' => 'R1', 'name' => 'Duplicada'])
            ->assertSessionHasErrors('code');

        $this->assertSame(1, CollectionRoute::where('office_id', $this->office->id)->where('code', 'R1')->count());

        // Mismo código en otra oficina sí se permite (NOR ya tiene R1, se crea R9 en ambas).
        $this->actingAs($this->admin)
            ->post(route('routes.store'), ['office_id' => $this->otherOffice->id, 'code' => 'R9', 'name' => 'Norte 9'])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->admin)
            ->post(route('routes.store'), ['office_id' => $this->office->id, 'code' => 'R9', 'name' => 'Centro 9'])
            ->assertSessionHasNoErrors();

        $this->assertSame(2, CollectionRoute::where('code', 'R9')->count());
    }

    public function test_route_requires_office_code_and_name(): void
    {
        $this->actingAs($this->admin)
            ->post(route('routes.store'), [])
            ->assertSessionHasErrors(['office_id', 'code', 'name']);
    }

    public function test_supervisor_creates_route_in_own_office_only(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('routes.store'), ['office_id' => $this->office->id, 'code' => 'R2', 'name' => 'Propia'])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('routes.index'));

        $this->actingAs($this->supervisor)
            ->post(route('routes.store'), ['office_id' => $this->otherOffice->id, 'code' => 'R2', 'name' => 'Ajena'])
            ->assertForbidden();

        $this->assertDatabaseMissing('collection_routes', ['name' => 'Ajena']);
    }

    public function test_supervisor_cannot_edit_or_move_routes_across_offices(): void
    {
        $this->actingAs($this->supervisor)
            ->put(route('routes.update', $this->otherRoute), ['office_id' => $this->otherOffice->id, 'code' => 'R1', 'name' => 'Ajena'])
            ->assertNotFound();

        $this->actingAs($this->supervisor)
            ->put(route('routes.update', $this->route), ['office_id' => $this->otherOffice->id, 'code' => 'R5', 'name' => 'Movida'])
            ->assertForbidden();

        $this->actingAs($this->supervisor)
            ->delete(route('routes.destroy', $this->otherRoute))
            ->assertNotFound();

        $this->assertSame($this->office->id, $this->route->fresh()?->office_id);
        $this->assertSame('Ruta Norte', $this->otherRoute->fresh()?->name);
    }

    public function test_supervisor_cannot_assign_collector_from_another_office(): void
    {
        $otherCollector = User::where('office_id', $this->otherOffice->id)->firstOrFail();

        $this->actingAs($this->supervisor)
            ->post(route('routes.store'), [
                'office_id' => $this->office->id,
                'collector_id' => $otherCollector->id,
                'code' => 'R2',
                'name' => 'Cobrador ajeno',
            ])
            ->assertSessionHasErrors('collector_id');
    }

    public function test_admin_deletes_route_without_clients(): void
    {
        $empty = CollectionRoute::create(['office_id' => $this->office->id, 'code' => 'R7', 'name' => 'Vacía']);

        $this->actingAs($this->admin)
            ->delete(route('routes.destroy', $empty))
            ->assertRedirect(route('routes.index'));

        $this->assertModelMissing($empty);
    }

    public function test_route_with_clients_cannot_be_deleted(): void
    {
        $this->actingAs($this->admin)
            ->from(route('routes.index'))
            ->delete(route('routes.destroy', $this->route))
            ->assertRedirect(route('routes.index'))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertModelExists($this->route);
    }

    public function test_collector_cannot_view_or_manage_routes(): void
    {
        $this->actingAs($this->collector)->get(route('routes.index'))->assertForbidden();
        $this->actingAs($this->collector)
            ->post(route('routes.store'), ['office_id' => $this->office->id, 'code' => 'R2', 'name' => 'X'])
            ->assertForbidden();
    }
}

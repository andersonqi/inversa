<?php

namespace Tests\Feature;

use App\Models\Office;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class OfficeManagementTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    public function test_admin_creates_an_office(): void
    {
        $this->actingAs($this->admin)
            ->post(route('offices.store'), [
                'code' => 'SUR',
                'name' => 'Sur',
                'city' => 'Escuintla',
                'phone' => '5555-5555',
                'is_active' => '1',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('offices.index'))
            ->assertInertiaFlash('toast.type', 'success');

        $office = Office::where('code', 'SUR')->firstOrFail();
        $this->assertSame('Sur', $office->name);
        $this->assertSame('Escuintla', $office->city);
        $this->assertTrue($office->is_active);
    }

    public function test_admin_updates_an_office_and_can_deactivate_it(): void
    {
        $this->actingAs($this->admin)
            ->put(route('offices.update', $this->office), [
                'code' => 'CEN',
                'name' => 'Central renovada',
                'city' => 'Mixco',
                'is_active' => '0',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('offices.index'));

        $office = $this->office->fresh();
        $this->assertSame('Central renovada', $office->name);
        $this->assertSame('Mixco', $office->city);
        $this->assertFalse($office->is_active);
    }

    public function test_office_code_must_be_unique(): void
    {
        $this->actingAs($this->admin)
            ->post(route('offices.store'), ['code' => 'NOR', 'name' => 'Duplicada'])
            ->assertSessionHasErrors('code');

        $this->assertSame(1, Office::where('code', 'NOR')->count());

        // Al editar, el propio código no choca consigo mismo, pero sí con el de otra oficina.
        $this->actingAs($this->admin)
            ->put(route('offices.update', $this->office), ['code' => 'CEN', 'name' => 'Central'])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->admin)
            ->put(route('offices.update', $this->office), ['code' => 'NOR', 'name' => 'Central'])
            ->assertSessionHasErrors('code');

        $this->assertSame('CEN', $this->office->fresh()->code);
    }

    public function test_office_requires_code_and_name(): void
    {
        $this->actingAs($this->admin)
            ->post(route('offices.store'), [])
            ->assertSessionHasErrors(['code', 'name']);
    }

    public function test_admin_deletes_an_empty_office(): void
    {
        $empty = Office::create(['code' => 'VAC', 'name' => 'Vacía']);

        $this->actingAs($this->admin)
            ->delete(route('offices.destroy', $empty))
            ->assertRedirect(route('offices.index'))
            ->assertInertiaFlash('toast.type', 'success');

        $this->assertModelMissing($empty);
    }

    public function test_office_with_routes_cannot_be_deleted(): void
    {
        $this->actingAs($this->admin)
            ->from(route('offices.index'))
            ->delete(route('offices.destroy', $this->office))
            ->assertRedirect(route('offices.index'))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertModelExists($this->office);
    }

    public function test_supervisor_can_view_index_but_cannot_manage_offices(): void
    {
        $this->actingAs($this->supervisor)->get(route('offices.index'))->assertOk();

        $this->actingAs($this->supervisor)
            ->post(route('offices.store'), ['code' => 'SUR', 'name' => 'Sur'])
            ->assertForbidden();

        $this->actingAs($this->supervisor)
            ->put(route('offices.update', $this->otherOffice), ['code' => 'NOR', 'name' => 'Hackeada'])
            ->assertForbidden();

        $this->actingAs($this->supervisor)
            ->put(route('offices.update', $this->office), ['code' => 'CEN', 'name' => 'Hackeada'])
            ->assertForbidden();

        $this->actingAs($this->supervisor)
            ->delete(route('offices.destroy', $this->otherOffice))
            ->assertForbidden();

        $this->assertDatabaseMissing('offices', ['code' => 'SUR']);
        $this->assertSame('Norte', $this->otherOffice->fresh()->name);
        $this->assertSame('Central', $this->office->fresh()->name);
    }

    public function test_supervisor_index_only_lists_own_office(): void
    {
        $this->actingAs($this->supervisor)
            ->get(route('offices.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('offices/index')
                ->has('offices.data', 1)
                ->where('offices.data.0.id', $this->office->id));
    }

    public function test_collector_cannot_view_offices(): void
    {
        $this->actingAs($this->collector)->get(route('offices.index'))->assertForbidden();
    }
}

<?php

namespace Tests\Feature;

use App\Enums\RoleScope;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class RoleManagementTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    public function test_admin_creates_a_role_with_permissions_and_scope(): void
    {
        $this->actingAs($this->admin)
            ->post(route('roles.store'), [
                'name' => 'Auditor',
                'description' => 'Solo lectura',
                'scope' => 'office',
                'permissions' => ['clients.view', 'reports.view'],
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('roles.index'))
            ->assertInertiaFlash('toast.type', 'success');

        $role = Role::where('name', 'Auditor')->firstOrFail();
        $this->assertSame(RoleScope::Office, $role->scope);
        $this->assertSame(['clients.view', 'reports.view'], $role->permissions);
        $this->assertTrue($role->allows('clients.view'));
        $this->assertFalse($role->allows('clients.manage'));
    }

    public function test_role_without_permissions_is_stored_with_empty_list(): void
    {
        $this->actingAs($this->admin)
            ->post(route('roles.store'), ['name' => 'Vacío', 'scope' => 'route'])
            ->assertSessionHasNoErrors();

        $this->assertSame([], Role::where('name', 'Vacío')->firstOrFail()->permissions);
    }

    public function test_invalid_permission_key_is_rejected(): void
    {
        $this->actingAs($this->admin)
            ->post(route('roles.store'), [
                'name' => 'Pirata',
                'scope' => 'all',
                'permissions' => ['clients.view', 'everything.hack'],
            ])
            ->assertSessionHasErrors('permissions.1');

        $this->assertDatabaseMissing('roles', ['name' => 'Pirata']);
    }

    public function test_invalid_scope_and_duplicate_name_are_rejected(): void
    {
        $this->actingAs($this->admin)
            ->post(route('roles.store'), ['name' => 'Supervisor', 'scope' => 'galaxy'])
            ->assertSessionHasErrors(['name', 'scope']);
    }

    public function test_admin_updates_a_role(): void
    {
        $role = Role::create(['name' => 'Auditor', 'scope' => RoleScope::Office, 'permissions' => ['clients.view']]);

        $this->actingAs($this->admin)
            ->put(route('roles.update', $role), [
                'name' => 'Auditor general',
                'scope' => 'all',
                'permissions' => ['reports.view', 'loans.view'],
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('roles.index'));

        $role->refresh();
        $this->assertSame('Auditor general', $role->name);
        $this->assertSame(RoleScope::All, $role->scope);
        $this->assertSame(['reports.view', 'loans.view'], $role->permissions);
    }

    public function test_admin_deletes_an_unused_role(): void
    {
        $role = Role::create(['name' => 'Temporal', 'scope' => RoleScope::Route, 'permissions' => []]);

        $this->actingAs($this->admin)
            ->delete(route('roles.destroy', $role))
            ->assertRedirect(route('roles.index'));

        $this->assertModelMissing($role);
    }

    public function test_role_with_users_cannot_be_deleted(): void
    {
        $role = Role::findOrFail($this->roleId('Cobrador'));

        $this->actingAs($this->admin)
            ->from(route('roles.index'))
            ->delete(route('roles.destroy', $role))
            ->assertRedirect(route('roles.index'))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertModelExists($role);
        $this->assertSame($role->id, $this->collector->fresh()?->role_id);
    }

    public function test_supervisor_and_collector_cannot_access_roles(): void
    {
        $role = Role::findOrFail($this->roleId('Cobrador'));

        foreach ([$this->supervisor, $this->collector] as $user) {
            /** @var User $user */
            $this->actingAs($user)->get(route('roles.index'))->assertForbidden();
            $this->actingAs($user)->get(route('roles.create'))->assertForbidden();
            $this->actingAs($user)
                ->post(route('roles.store'), ['name' => 'Súper', 'scope' => 'all', 'permissions' => ['roles.manage']])
                ->assertForbidden();
            $this->actingAs($user)
                ->put(route('roles.update', $role), ['name' => 'Cobrador', 'scope' => 'all', 'permissions' => ['roles.manage']])
                ->assertForbidden();
            $this->actingAs($user)->delete(route('roles.destroy', $role))->assertForbidden();
        }

        $this->assertDatabaseMissing('roles', ['name' => 'Súper']);
        $this->assertSame(RoleScope::Route, $role->fresh()?->scope);
    }
}

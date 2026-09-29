<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class UserManagementTest extends TestCase
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
            'name' => 'Nuevo Cobrador',
            'email' => 'nuevo@inversa.test',
            'phone' => '4444-4444',
            'role_id' => $this->roleId('Cobrador'),
            'office_id' => $this->office->id,
            'is_active' => '1',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
            ...$overrides,
        ];
    }

    public function test_admin_creates_a_user_who_can_then_log_in(): void
    {
        $this->actingAs($this->admin)
            ->post(route('users.store'), $this->payload())
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('users.index'))
            ->assertInertiaFlash('toast.type', 'success');

        $user = User::where('email', 'nuevo@inversa.test')->firstOrFail();
        $this->assertSame($this->roleId('Cobrador'), $user->role_id);
        $this->assertSame($this->office->id, $user->office_id);
        $this->assertTrue($user->is_active);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Hash::check('secreto123', $user->password));

        auth()->logout();

        $this->post(route('login.store'), ['email' => 'nuevo@inversa.test', 'password' => 'secreto123']);

        $this->assertAuthenticatedAs($user);
    }

    public function test_password_must_be_confirmed(): void
    {
        $this->actingAs($this->admin)
            ->post(route('users.store'), $this->payload(['password_confirmation' => 'otra-cosa']))
            ->assertSessionHasErrors('password');

        $this->assertDatabaseMissing('users', ['email' => 'nuevo@inversa.test']);
    }

    public function test_password_is_required_on_create(): void
    {
        $this->actingAs($this->admin)
            ->post(route('users.store'), $this->payload(['password' => '', 'password_confirmation' => '']))
            ->assertSessionHasErrors('password');
    }

    public function test_email_must_be_unique(): void
    {
        $this->actingAs($this->admin)
            ->post(route('users.store'), $this->payload(['email' => $this->collector->email]))
            ->assertSessionHasErrors('email');
    }

    public function test_update_without_password_keeps_old_password(): void
    {
        $oldHash = $this->collector->password;

        $this->actingAs($this->admin)
            ->put(route('users.update', $this->collector), $this->payload([
                'name' => 'Cobrador Renombrado',
                'email' => $this->collector->email,
                'password' => '',
                'password_confirmation' => '',
            ]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('users.index'));

        $user = $this->collector->fresh();
        $this->assertSame('Cobrador Renombrado', $user->name);
        $this->assertSame($oldHash, $user->password);
        $this->assertTrue(Hash::check('password', $user->password));
    }

    public function test_update_with_password_changes_it(): void
    {
        $this->actingAs($this->admin)
            ->put(route('users.update', $this->collector), $this->payload([
                'email' => $this->collector->email,
                'password' => 'cambiada123',
                'password_confirmation' => 'cambiada123',
            ]))
            ->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('cambiada123', (string) $this->collector->fresh()?->password));
    }

    public function test_non_global_role_requires_an_office(): void
    {
        $this->actingAs($this->admin)
            ->post(route('users.store'), $this->payload(['office_id' => null]))
            ->assertSessionHasErrors('office_id');

        $this->assertDatabaseMissing('users', ['email' => 'nuevo@inversa.test']);

        // Un administrador (alcance "all") no necesita oficina.
        $this->actingAs($this->admin)
            ->post(route('users.store'), $this->payload(['role_id' => $this->roleId('Administrador'), 'office_id' => null]))
            ->assertSessionHasNoErrors();

        $this->assertNull(User::where('email', 'nuevo@inversa.test')->firstOrFail()->office_id);
    }

    public function test_supervisor_creates_users_only_in_own_office(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('users.store'), $this->payload(['office_id' => $this->otherOffice->id]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('users.index'));

        $this->assertSame($this->office->id, User::where('email', 'nuevo@inversa.test')->firstOrFail()->office_id);
    }

    public function test_supervisor_cannot_assign_administrator_role(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('users.store'), $this->payload(['role_id' => $this->roleId('Administrador')]))
            ->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'nuevo@inversa.test']);

        $this->actingAs($this->supervisor)
            ->put(route('users.update', $this->collector), $this->payload([
                'email' => $this->collector->email,
                'role_id' => $this->roleId('Administrador'),
                'password' => '',
                'password_confirmation' => '',
            ]))
            ->assertForbidden();

        $this->assertSame($this->roleId('Cobrador'), $this->collector->fresh()?->role_id);
    }

    public function test_supervisor_cannot_manage_users_of_other_offices(): void
    {
        $otherCollector = User::where('office_id', $this->otherOffice->id)->firstOrFail();

        $this->actingAs($this->supervisor)
            ->put(route('users.update', $otherCollector), $this->payload([
                'email' => $otherCollector->email,
                'password' => '',
                'password_confirmation' => '',
            ]))
            ->assertNotFound();

        $this->actingAs($this->supervisor)
            ->delete(route('users.destroy', $otherCollector))
            ->assertNotFound();

        $this->assertTrue($otherCollector->fresh()?->is_active);
    }

    public function test_collector_cannot_manage_users(): void
    {
        $this->actingAs($this->collector)->get(route('users.index'))->assertForbidden();
        $this->actingAs($this->collector)->post(route('users.store'), $this->payload())->assertForbidden();
    }

    public function test_destroy_deactivates_user_who_then_cannot_log_in(): void
    {
        $this->actingAs($this->admin)
            ->delete(route('users.destroy', $this->collector))
            ->assertRedirect(route('users.index'));

        $this->assertModelExists($this->collector);
        $this->assertFalse($this->collector->fresh()?->is_active);

        auth()->logout();

        $this->post(route('login.store'), ['email' => $this->collector->email, 'password' => 'password'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_user_cannot_deactivate_themselves(): void
    {
        $this->actingAs($this->admin)
            ->from(route('users.index'))
            ->delete(route('users.destroy', $this->admin))
            ->assertRedirect(route('users.index'))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertTrue($this->admin->fresh()?->is_active);
    }
}

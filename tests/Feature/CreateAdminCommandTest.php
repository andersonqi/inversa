<?php

namespace Tests\Feature;

use App\Enums\RoleScope;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_an_administrator_on_an_empty_database(): void
    {
        $this->artisan('inversa:admin', [
            '--name' => 'Dueño',
            '--email' => 'dueno@inversa.test',
            '--password' => 'secreto123',
        ])->assertSuccessful();

        $user = User::where('email', 'dueno@inversa.test')->firstOrFail();

        $this->assertSame('Administrador', $user->role?->name);
        $this->assertSame(RoleScope::All, $user->scope());
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue($user->hasPermission('roles.manage'));
    }

    public function test_it_promotes_and_resets_an_existing_user(): void
    {
        $user = User::factory()->create(['email' => 'existente@inversa.test', 'is_active' => false]);

        $this->artisan('inversa:admin', [
            '--name' => 'Existente',
            '--email' => 'existente@inversa.test',
            '--password' => 'nueva-clave',
        ])->assertSuccessful();

        $user->refresh();

        $this->assertTrue($user->is_active);
        $this->assertSame('Administrador', $user->role?->name);
        $this->assertSame(1, User::count());
    }
}

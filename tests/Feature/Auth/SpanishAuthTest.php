<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SpanishAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_auth_pages_render(): void
    {
        $this->get(route('login'))->assertOk()->assertInertia(fn (Assert $page) => $page->component('auth/login'));
        $this->get(route('password.request'))->assertOk()->assertInertia(fn (Assert $page) => $page->component('auth/forgot-password'));
        $this->get(route('password.reset', ['token' => 'x']))->assertOk()->assertInertia(fn (Assert $page) => $page->component('auth/reset-password'));
    }

    public function test_failed_login_message_is_in_spanish(): void
    {
        $user = User::factory()->create();

        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'incorrecta'])
            ->assertSessionHasErrors(['email' => 'Estas credenciales no coinciden con nuestros registros.']);
    }

    public function test_validation_messages_are_in_spanish(): void
    {
        $this->post(route('login.store'), ['email' => '', 'password' => ''])
            ->assertSessionHasErrors(['email' => 'El campo correo electrónico es obligatorio.']);
    }

    public function test_inactive_users_cannot_log_in(): void
    {
        $user = User::factory()->create(['is_active' => false]);

        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_public_registration_is_disabled(): void
    {
        $this->get('/register')->assertNotFound();
    }
}

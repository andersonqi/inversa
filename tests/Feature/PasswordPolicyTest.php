<?php

namespace Tests\Feature;

use App\Models\User;
use App\Rules\PasswordOrPin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class PasswordPolicyTest extends TestCase
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
            'name' => 'Cobrador con PIN',
            'email' => 'pin@inversa.test',
            'role_id' => $this->roleId('Cobrador'),
            'office_id' => $this->office->id,
            'is_active' => '1',
            'password' => '2580',
            'password_confirmation' => '2580',
            ...$overrides,
        ];
    }

    public function test_admin_creates_a_user_with_a_four_digit_pin_who_can_log_in(): void
    {
        $this->actingAs($this->admin)
            ->post(route('users.store'), $this->payload())
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('users.index'));

        $user = User::where('email', 'pin@inversa.test')->firstOrFail();
        $this->assertTrue(Hash::check('2580', $user->password));

        auth()->logout();

        $this->post(route('login.store'), ['email' => 'pin@inversa.test', 'password' => '2580']);

        $this->assertAuthenticatedAs($user);
    }

    public function test_simple_passwords_without_uppercase_numbers_or_symbols_are_accepted(): void
    {
        foreach (['casita', 'ruta norte', '123456'] as $index => $password) {
            $this->actingAs($this->admin)
                ->post(route('users.store'), $this->payload([
                    'email' => "simple{$index}@inversa.test",
                    'password' => $password,
                    'password_confirmation' => $password,
                ]))
                ->assertSessionHasNoErrors();
        }

        $this->assertSame(3, User::where('email', 'like', 'simple%')->count());
    }

    public function test_too_short_passwords_and_pins_of_other_lengths_are_rejected(): void
    {
        foreach (['123', '12345', 'abc', 'clave', '12a4'] as $password) {
            $this->actingAs($this->admin)
                ->post(route('users.store'), $this->payload([
                    'password' => $password,
                    'password_confirmation' => $password,
                ]))
                ->assertSessionHasErrors(['password' => PasswordOrPin::MESSAGE]);
        }

        $this->assertDatabaseMissing('users', ['email' => 'pin@inversa.test']);
    }

    public function test_admin_can_switch_a_user_to_a_pin(): void
    {
        $this->actingAs($this->admin)
            ->put(route('users.update', $this->collector), $this->payload([
                'name' => $this->collector->name,
                'email' => $this->collector->email,
                'password' => '0007',
                'password_confirmation' => '0007',
            ]))
            ->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('0007', (string) $this->collector->fresh()?->password));
    }

    public function test_users_can_change_their_own_password_to_a_pin(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->from(route('security.edit'))
            ->put(route('user-password.update'), [
                'current_password' => 'password',
                'password' => '4321',
                'password_confirmation' => '4321',
            ])
            ->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('4321', $user->refresh()->password));
    }

    public function test_rule_accepts_pin_or_six_characters(): void
    {
        $valid = fn (mixed $value): bool => Validator::make(['password' => $value], ['password' => [new PasswordOrPin]])->passes();

        $this->assertTrue($valid('1234'));
        $this->assertTrue($valid('abcdef'));
        $this->assertTrue($valid('1234567'));
        $this->assertFalse($valid('123'));
        $this->assertFalse($valid('12345'));
        $this->assertFalse($valid('abcde'));
        $this->assertFalse($valid(str_repeat('a', 73)));
    }

    public function test_login_attempts_are_limited_per_account_from_any_device(): void
    {
        $user = User::factory()->create();

        // 20 intentos fallidos a la misma cuenta desde otros dispositivos.
        RateLimiter::increment(md5('login'.'account|'.$user->email), amount: 20);

        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
            ->assertTooManyRequests();

        $this->assertGuest();
    }
}

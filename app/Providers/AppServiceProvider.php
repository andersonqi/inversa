<?php

namespace App\Providers;

use App\Models\User;
use App\Rules\PasswordOrPin;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configurePermissions();
    }

    /**
     * Los permisos se definen por rol (ver App\Support\Permissions).
     */
    protected function configurePermissions(): void
    {
        Gate::before(fn (User $user, string $ability): ?bool => $user->hasPermission($ability) ? true : null);
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        // Claves sencillas a pedido de la empresa: la validación real es PasswordOrPin
        // (PIN de 4 dígitos o contraseña de 6+ caracteres); esto queda como referencia
        // para los gestores de contraseñas del navegador.
        Password::defaults(fn (): Password => Password::min(PasswordOrPin::MIN_LENGTH));
    }
}

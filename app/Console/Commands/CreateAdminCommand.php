<?php

namespace App\Console\Commands;

use App\Enums\RoleScope;
use App\Models\Role;
use App\Models\User;
use App\Rules\PasswordOrPin;
use App\Support\Permissions;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

class CreateAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inversa:admin
        {--name= : Nombre del administrador}
        {--email= : Correo con el que ingresará}
        {--password= : Contraseña (si se omite, se pregunta de forma oculta)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Crea (o restablece) un usuario Administrador con acceso a todas las oficinas';

    public function handle(): int
    {
        $name = $this->option('name') ?: text('Nombre', required: true, default: 'Administrador');
        $email = $this->option('email') ?: text('Correo electrónico', required: true);
        $password = $this->option('password') ?: password('Contraseña', required: true);

        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'password' => $password],
            [
                'name' => ['required', 'string', 'max:120'],
                'email' => ['required', 'email', 'max:255'],
                'password' => ['required', 'string', new PasswordOrPin],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->components->error($error);
            }

            return self::FAILURE;
        }

        // El rol se crea aquí también para que el comando funcione en una base recién migrada sin seeders.
        $role = Role::firstOrCreate(['name' => 'Administrador'], [
            'description' => 'Acceso total a todas las oficinas.',
            'scope' => RoleScope::All,
            'permissions' => Permissions::all(),
        ]);

        $user = User::firstOrNew(['email' => $email]);
        $exists = $user->exists;

        $user->forceFill([
            'name' => $name,
            'password' => $password,
            'role_id' => $role->id,
            'office_id' => null,
            'is_active' => true,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        $this->components->info($exists
            ? "Usuario {$email} actualizado como Administrador."
            : "Administrador {$email} creado.");

        return self::SUCCESS;
    }
}

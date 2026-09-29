<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        User::updateOrCreate(['email' => 'admin@inversa.test'], [
            'name' => 'Administrador',
            'password' => 'password',
            'role_id' => Role::where('name', 'Administrador')->value('id'),
            'email_verified_at' => now(),
        ]);

        if (app()->isLocal()) {
            $this->call(DemoSeeder::class);
        }
    }
}

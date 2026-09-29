<?php

namespace Database\Seeders;

use App\Enums\RoleScope;
use App\Models\Role;
use App\Support\Permissions;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        Role::updateOrCreate(['name' => 'Administrador'], [
            'description' => 'Acceso total a todas las oficinas.',
            'scope' => RoleScope::All,
            'permissions' => Permissions::all(),
        ]);

        Role::updateOrCreate(['name' => 'Supervisor'], [
            'description' => 'Administra una oficina: rutas, clientes, máquinas, cortes, gastos y préstamos.',
            'scope' => RoleScope::Office,
            'permissions' => array_values(array_diff(Permissions::all(), ['roles.view', 'roles.manage', 'offices.manage'])),
        ]);

        Role::updateOrCreate(['name' => 'Cobrador'], [
            'description' => 'Recorre sus rutas: registra cortes, abonos y gastos.',
            'scope' => RoleScope::Route,
            'permissions' => [
                'clients.view',
                'machines.view',
                'collections.view',
                'collections.create',
                'expenses.view',
                'expenses.manage',
                'loans.view',
                'loans.pay',
            ],
        ]);
    }
}

<?php

namespace App\Support;

class Permissions
{
    /**
     * Catálogo de permisos agrupados por módulo.
     *
     * @var array<string, array<string, string>>
     */
    public const MODULES = [
        'Usuarios' => [
            'users.view' => 'Ver usuarios',
            'users.manage' => 'Crear y editar usuarios',
        ],
        'Roles' => [
            'roles.view' => 'Ver roles',
            'roles.manage' => 'Crear y editar roles',
        ],
        'Oficinas' => [
            'offices.view' => 'Ver oficinas',
            'offices.manage' => 'Crear y editar oficinas',
        ],
        'Rutas' => [
            'routes.view' => 'Ver rutas',
            'routes.manage' => 'Crear y editar rutas',
        ],
        'Clientes' => [
            'clients.view' => 'Ver clientes',
            'clients.manage' => 'Crear y editar clientes',
        ],
        'Máquinas' => [
            'machines.view' => 'Ver máquinas',
            'machines.manage' => 'Crear, editar e instalar máquinas',
            'machines.move' => 'Mover máquinas: transferir, enviar a bodega e instalar',
        ],
        'Cortes' => [
            'collections.view' => 'Ver cortes',
            'collections.create' => 'Registrar cortes',
            'collections.delete' => 'Anular cortes',
        ],
        'Gastos' => [
            'expenses.view' => 'Ver gastos',
            'expenses.manage' => 'Registrar y editar gastos',
        ],
        'Préstamos' => [
            'loans.view' => 'Ver préstamos',
            'loans.manage' => 'Otorgar y anular préstamos',
            'loans.pay' => 'Registrar abonos',
        ],
        'Reportes' => [
            'reports.view' => 'Ver reportes',
        ],
        'Notificaciones' => [
            'notifications.send' => 'Enviar notificaciones a cobradores',
        ],
        'Configuración' => [
            'settings.manage' => 'Configurar parámetros (montos de rendimiento, logo y color de la empresa, días que se guardan las fotos de contadores)',
        ],
    ];

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return array_keys(array_merge(...array_values(self::MODULES)));
    }
}

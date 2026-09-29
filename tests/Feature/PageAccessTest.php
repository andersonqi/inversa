<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

/**
 * Recorre todas las pantallas con cada rol: la página debe renderizar su componente
 * cuando el rol tiene el permiso y responder 403 cuando no lo tiene.
 */
class PageAccessTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    /**
     * @return array<string, array{0: string, 1: string, 2: string|null}>
     */
    public static function pages(): array
    {
        return [
            'panel' => ['/dashboard', 'dashboard', null],
            'oficinas' => ['/offices?search=cen&page=1', 'offices/index', 'offices.view'],
            'nueva oficina' => ['/offices/create', 'offices/form', 'offices.manage'],
            'editar oficina' => ['/offices/{office}/edit', 'offices/form', 'offices.manage'],
            'roles' => ['/roles', 'roles/index', 'roles.view'],
            'nuevo rol' => ['/roles/create', 'roles/form', 'roles.manage'],
            'usuarios' => ['/users?search=a&role_id=1', 'users/index', 'users.view'],
            'nuevo usuario' => ['/users/create', 'users/form', 'users.manage'],
            'rutas' => ['/routes?search=r&office_id={office}', 'routes/index', 'routes.view'],
            'nueva ruta' => ['/routes/create', 'routes/form', 'routes.manage'],
            'editar ruta' => ['/routes/{route}/edit', 'routes/form', 'routes.manage'],
            'clientes' => ['/clients?search=abar&route_id={route}', 'clients/index', 'clients.view'],
            'cliente' => ['/clients/{client}?page=1', 'clients/show', 'clients.view'],
            'nuevo cliente' => ['/clients/create', 'clients/form', 'clients.manage'],
            'editar cliente' => ['/clients/{client}/edit', 'clients/form', 'clients.manage'],
            'maquinas' => ['/machines?search=maq&status=installed', 'machines/index', 'machines.view'],
            'maquina' => ['/machines/{machine}', 'machines/show', 'machines.view'],
            'nueva maquina' => ['/machines/create', 'machines/form', 'machines.manage'],
            'editar maquina' => ['/machines/{machine}/edit', 'machines/form', 'machines.manage'],
            'cortes' => ['/collections?search=abar&route_id={route}', 'collections/index', 'collections.view'],
            'registrar corte' => ['/collections/create?client_id={client}', 'collections/create', 'collections.create'],
            'corte' => ['/collections/{collection}', 'collections/show', 'collections.view'],
            'gastos' => ['/expenses?category=fuel', 'expenses/index', 'expenses.view'],
            'nuevo gasto' => ['/expenses/create', 'expenses/form', 'expenses.manage'],
            'prestamos' => ['/loans?status=all&search=abar', 'loans/index', 'loans.view'],
            'nuevo prestamo' => ['/loans/create?client_id={client}', 'loans/create', 'loans.manage'],
            'prestamo' => ['/loans/{loan}', 'loans/show', 'loans.view'],
            'reportes' => ['/reports', 'reports/index', 'reports.view'],
            'cuadre diario' => ['/reports/daily?office_id={office}', 'reports/daily', 'reports.view'],
            'maquinas perdedoras' => ['/reports/machines?only_losing=1', 'reports/machines', 'reports.view'],
            'rendimiento maquinas' => ['/reports/machines?only_losing=0&page=2', 'reports/machines', 'reports.view'],
            'rentabilidad rutas' => ['/reports/routes', 'reports/routes', 'reports.view'],
            'cartera' => ['/reports/loans', 'reports/loans', 'reports.view'],
            'perfil' => ['/settings/profile', 'settings/profile', null],
            'apariencia' => ['/settings/appearance', 'settings/appearance', null],
        ];
    }

    #[DataProvider('pages')]
    public function test_administrator_sees_every_page(string $uri, string $component, ?string $permission): void
    {
        $this->assertPage($this->admin, $uri, $component, $permission);
    }

    #[DataProvider('pages')]
    public function test_supervisor_sees_only_permitted_pages(string $uri, string $component, ?string $permission): void
    {
        $this->assertPage($this->supervisor, $uri, $component, $permission);
    }

    #[DataProvider('pages')]
    public function test_collector_sees_only_permitted_pages(string $uri, string $component, ?string $permission): void
    {
        $this->assertPage($this->collector, $uri, $component, $permission);
    }

    public function test_guests_are_sent_to_login(): void
    {
        foreach (['/dashboard', '/clients', '/collections/create', '/reports/daily'] as $uri) {
            $this->get($uri)->assertRedirect(route('login'));
        }
    }

    public function test_records_of_another_office_are_hidden_from_supervisors_and_collectors(): void
    {
        foreach ([$this->supervisor, $this->collector] as $user) {
            $this->actingAs($user)->get(route('clients.show', $this->otherClient))->assertNotFound();
            $this->actingAs($user)->get(route('machines.show', $this->otherMachine))->assertNotFound();
        }

        $this->actingAs($this->supervisor)->get(route('routes.edit', $this->otherRoute))->assertNotFound();
        $this->actingAs($this->supervisor)->get(route('offices.edit', $this->otherOffice))->assertForbidden();
    }

    public function test_lists_only_include_records_in_the_users_scope(): void
    {
        $this->actingAs($this->admin)->get('/clients')
            ->assertInertia(fn (Assert $page) => $page->has('clients.data', 2));

        $this->actingAs($this->supervisor)->get('/clients')
            ->assertInertia(fn (Assert $page) => $page->has('clients.data', 1)->where('clients.data.0.id', $this->client->id));

        $this->actingAs($this->collector)->get('/machines')
            ->assertInertia(fn (Assert $page) => $page->has('machines.data', 1)->where('machines.data.0.id', $this->machine->id));

        $this->actingAs($this->supervisor)->get('/collections')
            ->assertInertia(fn (Assert $page) => $page->has('collections.data', 1));
    }

    public function test_index_pages_are_paginated(): void
    {
        $this->actingAs($this->admin)->get('/machines')
            ->assertInertia(fn (Assert $page) => $page
                ->has('machines.data')
                ->has('machines.links')
                ->where('machines.current_page', 1)
                ->where('machines.total', 2));
    }

    private function assertPage(User $user, string $uri, string $component, ?string $permission): void
    {
        $uri = strtr($uri, [
            '{office}' => (string) $this->office->id,
            '{route}' => (string) $this->route->id,
            '{client}' => (string) $this->client->id,
            '{machine}' => (string) $this->machine->id,
            '{collection}' => (string) $this->collection->id,
            '{loan}' => (string) $this->loan->id,
        ]);

        $response = $this->actingAs($user)->get($uri);

        if ($permission !== null && ! $user->hasPermission($permission)) {
            $response->assertForbidden();

            return;
        }

        $response->assertOk()->assertInertia(fn (Assert $page) => $page->component($component));
    }
}

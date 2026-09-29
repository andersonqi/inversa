<?php

namespace App\Http\Controllers;

use App\Enums\RoleScope;
use App\Models\Role;
use App\Support\Permissions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('roles/index', [
            'roles' => Role::query()->withCount('users')->orderBy('name')->paginate(20)->withQueryString(),
            'scopes' => RoleScope::options(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('roles/form', $this->formProps(null));
    }

    public function store(Request $request): RedirectResponse
    {
        Role::create($this->validated($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Rol creado.']);

        return to_route('roles.index');
    }

    public function edit(Role $role): Response
    {
        return Inertia::render('roles/form', $this->formProps($role));
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        $role->update($this->validated($request, $role));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Rol actualizado.']);

        return to_route('roles.index');
    }

    public function destroy(Role $role): RedirectResponse
    {
        if ($role->users()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'No se puede eliminar un rol con usuarios asignados.']);

            return back();
        }

        $role->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Rol eliminado.']);

        return to_route('roles.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function formProps(?Role $role): array
    {
        $modules = [];

        foreach (Permissions::MODULES as $module => $permissions) {
            $modules[] = [
                'module' => $module,
                'permissions' => collect($permissions)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            ];
        }

        return [
            'role' => $role,
            'modules' => $modules,
            'scopes' => RoleScope::options(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Role $role = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('roles')->ignore($role)],
            'description' => ['nullable', 'string', 'max:255'],
            'scope' => ['required', Rule::enum(RoleScope::class)],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::in(Permissions::all())],
        ]);

        $data['permissions'] = array_values($data['permissions'] ?? []);

        return $data;
    }
}

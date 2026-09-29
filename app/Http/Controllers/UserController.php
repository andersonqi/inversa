<?php

namespace App\Http\Controllers;

use App\Enums\RoleScope;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $users = User::query()
            ->with(['role:id,name', 'office:id,name'])
            ->when(! $request->user()->seesAllOffices(), fn ($q) => $q->where('office_id', $request->user()->office_id))
            ->when($request->string('search')->value(), fn ($q, $search) => $q->whereAny(['name', 'email', 'phone'], 'ilike', "%{$search}%"))
            ->when($request->integer('office_id'), fn ($q, $officeId) => $q->where('office_id', $officeId))
            ->when($request->integer('role_id'), fn ($q, $roleId) => $q->where('role_id', $roleId))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('users/index', [
            'users' => $users,
            'filters' => $request->only('search', 'office_id', 'role_id'),
            'offices' => $this->officeOptions($request->user()),
            'roles' => Role::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('users/form', $this->formProps($request, null));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $data['email_verified_at'] = now();

        User::create($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Usuario creado.']);

        return to_route('users.index');
    }

    public function edit(Request $request, User $user): Response
    {
        $this->ensureManageable($request, $user);

        return Inertia::render('users/form', $this->formProps($request, $user));
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $this->ensureManageable($request, $user);

        $data = $this->validated($request, $user);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->update($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Usuario actualizado.']);

        return to_route('users.index');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->ensureManageable($request, $user);

        if ($user->is($request->user())) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'No puede eliminar su propio usuario.']);

            return back();
        }

        // Los usuarios con movimientos se desactivan para conservar el historial.
        $user->update(['is_active' => false]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Usuario desactivado.']);

        return to_route('users.index');
    }

    private function ensureManageable(Request $request, User $user): void
    {
        abort_unless($request->user()->seesAllOffices() || $user->office_id === $request->user()->office_id, 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function formProps(Request $request, ?User $user): array
    {
        return [
            'user' => $user?->only('id', 'name', 'email', 'phone', 'role_id', 'office_id', 'is_active'),
            'offices' => $this->officeOptions($request->user()),
            'roles' => Role::query()
                ->when(! $request->user()->seesAllOffices(), fn ($q) => $q->where('scope', '!=', RoleScope::All))
                ->orderBy('name')
                ->get(['id', 'name', 'scope']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?User $user = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($user)],
            'phone' => ['nullable', 'string', 'max:40'],
            'role_id' => ['required', 'exists:roles,id'],
            'office_id' => ['nullable', 'exists:offices,id'],
            'is_active' => ['boolean'],
            'password' => [$user ? 'nullable' : 'required', 'string', Password::default(), 'confirmed'],
        ]);

        $role = Role::findOrFail($request->integer('role_id'));

        if ($role->scope !== RoleScope::All && empty($data['office_id'])) {
            throw ValidationException::withMessages(['office_id' => 'Este rol requiere una oficina.']);
        }

        if (! $request->user()->seesAllOffices()) {
            abort_if($role->scope === RoleScope::All, 403);
            $data['office_id'] = $request->user()->office_id;
        }

        return $data;
    }
}

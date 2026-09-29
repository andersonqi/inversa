<?php

namespace App\Http\Controllers;

use App\Models\CollectionRoute;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CollectionRouteController extends Controller
{
    public function index(Request $request): Response
    {
        $routes = CollectionRoute::query()
            ->visibleTo($request->user())
            ->with(['office:id,name', 'collector:id,name'])
            ->withCount('clients')
            ->when($request->string('search')->value(), fn ($q, $search) => $q->whereAny(['name', 'code'], 'ilike', "%{$search}%"))
            ->when($request->integer('office_id'), fn ($q, $officeId) => $q->where('office_id', $officeId))
            ->orderBy('office_id')
            ->orderBy('code')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('routes/index', [
            'routes' => $routes,
            'filters' => $request->only('search', 'office_id'),
            'offices' => $this->officeOptions($request->user()),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('routes/form', $this->formProps($request, null));
    }

    public function store(Request $request): RedirectResponse
    {
        CollectionRoute::create($this->validated($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ruta creada.']);

        return to_route('routes.index');
    }

    public function edit(Request $request, CollectionRoute $route): Response
    {
        $this->ensureVisible($request, $route);

        return Inertia::render('routes/form', $this->formProps($request, $route));
    }

    public function update(Request $request, CollectionRoute $route): RedirectResponse
    {
        $this->ensureVisible($request, $route);

        $route->update($this->validated($request, $route));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ruta actualizada.']);

        return to_route('routes.index');
    }

    public function destroy(Request $request, CollectionRoute $route): RedirectResponse
    {
        $this->ensureVisible($request, $route);

        if ($route->clients()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'La ruta tiene clientes; desactívela en lugar de eliminarla.']);

            return back();
        }

        $route->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ruta eliminada.']);

        return to_route('routes.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function formProps(Request $request, ?CollectionRoute $route): array
    {
        $offices = $this->officeOptions($request->user());

        return [
            'route' => $route,
            'offices' => $offices,
            'collectors' => User::query()
                ->where('is_active', true)
                ->whereIn('office_id', $offices->pluck('id'))
                ->orderBy('name')
                ->get(['id', 'name', 'office_id']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?CollectionRoute $route = null): array
    {
        $data = $request->validate([
            'office_id' => ['required', 'integer', 'exists:offices,id'],
            // El cobrador debe ser de la misma oficina: si no, vería clientes de otra oficina.
            'collector_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('office_id', $request->integer('office_id'))],
            'code' => ['required', 'string', 'max:20', Rule::unique('collection_routes')->where('office_id', $request->integer('office_id'))->ignore($route)],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $this->ensureOfficeAllowed($request->user(), $data['office_id']);

        return $data;
    }
}

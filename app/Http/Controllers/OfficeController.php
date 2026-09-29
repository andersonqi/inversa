<?php

namespace App\Http\Controllers;

use App\Models\Office;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OfficeController extends Controller
{
    public function index(Request $request): Response
    {
        $offices = Office::query()
            ->visibleTo($request->user())
            ->withCount(['routes', 'users', 'machines'])
            ->when($request->string('search')->value(), fn ($q, $search) => $q->whereAny(['name', 'code', 'city'], 'ilike', "%{$search}%"))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('offices/index', [
            'offices' => $offices,
            'filters' => $request->only('search'),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('offices/form', ['office' => null]);
    }

    public function store(Request $request): RedirectResponse
    {
        Office::create($this->validated($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Oficina creada.']);

        return to_route('offices.index');
    }

    public function edit(Request $request, Office $office): Response
    {
        $this->ensureVisible($request, $office);

        return Inertia::render('offices/form', ['office' => $office]);
    }

    public function update(Request $request, Office $office): RedirectResponse
    {
        $this->ensureVisible($request, $office);

        $office->update($this->validated($request, $office));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Oficina actualizada.']);

        return to_route('offices.index');
    }

    public function destroy(Request $request, Office $office): RedirectResponse
    {
        $this->ensureVisible($request, $office);

        if ($office->routes()->exists() || $office->machines()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'La oficina tiene rutas o máquinas; desactívela en lugar de eliminarla.']);

            return back();
        }

        $office->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Oficina eliminada.']);

        return to_route('offices.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Office $office = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:20', Rule::unique('offices')->ignore($office)],
            'name' => ['required', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'is_active' => ['boolean'],
        ]);
    }
}

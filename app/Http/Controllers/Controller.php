<?php

namespace App\Http\Controllers;

use App\Models\CollectionRoute;
use App\Models\Contracts\VisibleToUser;
use App\Models\Office;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

abstract class Controller
{
    /**
     * Responde 404 si el registro está fuera del alcance de datos del usuario.
     */
    protected function ensureVisible(Request $request, VisibleToUser $model): void
    {
        abort_unless($model->isVisibleTo($request->user()), 404);
    }

    /**
     * @return Collection<int, array{id: int, name: string}>
     */
    protected function officeOptions(User $user): Collection
    {
        return Office::query()
            ->visibleTo($user)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Office $office) => ['id' => $office->id, 'name' => $office->name]);
    }

    /**
     * @return Collection<int, array{id: int, name: non-falsy-string, office_id: int}>
     */
    protected function routeOptions(User $user): Collection
    {
        return CollectionRoute::query()
            ->visibleTo($user)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'office_id'])
            ->map(fn (CollectionRoute $route) => [
                'id' => $route->id,
                'name' => "{$route->code} · {$route->name}",
                'office_id' => $route->office_id,
            ]);
    }

    /**
     * Rechaza oficinas fuera del alcance del usuario.
     */
    protected function ensureOfficeAllowed(User $user, int $officeId): void
    {
        abort_unless(Office::query()->visibleTo($user)->whereKey($officeId)->exists(), 403);
    }

    /**
     * Rechaza rutas fuera del alcance del usuario.
     */
    protected function ensureRouteAllowed(User $user, int $routeId): void
    {
        abort_unless(CollectionRoute::query()->visibleTo($user)->whereKey($routeId)->exists(), 403);
    }
}

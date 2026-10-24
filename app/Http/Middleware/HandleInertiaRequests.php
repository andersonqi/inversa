<?php

namespace App\Http\Middleware;

use App\Services\ExchangeRateService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user()?->loadMissing(['role', 'office:id,name']),
                'permissions' => $request->user()?->role->permissions ?? [],
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'exchangeRate' => fn () => $request->user() ? $this->exchangeRate() : null,
        ];
    }

    /**
     * Tipo de cambio vigente. Si está vencido se actualiza después de enviar la respuesta,
     * para no hacer esperar la página por la consulta a Banguat.
     *
     * @return array{rate: float, date: string, source: string, fetched_at: string}|null
     */
    private function exchangeRate(): ?array
    {
        $service = app(ExchangeRateService::class);

        if (config('services.exchange_rate.auto_refresh') && $service->isStale()) {
            app()->terminating(fn () => $service->refreshIfStale());
        }

        return $service->current();
    }
}

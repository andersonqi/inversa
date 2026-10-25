<?php

use App\Http\Controllers\BrandingController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\CollectionController;
use App\Http\Controllers\CollectionRouteController;
use App\Http\Controllers\CollectionSyncController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExchangeRateController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\GeocodingController;
use App\Http\Controllers\LoanController;
use App\Http\Controllers\LoanPaymentController;
use App\Http\Controllers\MachineController;
use App\Http\Controllers\MachineMovementController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\PerformanceSettingsController;
use App\Http\Controllers\PhotoSettingsController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

// Logo de la empresa: público porque también se muestra en la pantalla de ingreso.
Route::get('branding/logo', [BrandingController::class, 'logo'])->name('branding.logo');

// Verificación del dominio para la app de Android (TWA): sin ella el APK muestra la
// barra de direcciones del navegador. Vacío mientras no se configure el paquete.
Route::get('.well-known/assetlinks.json', function () {
    $package = config('services.android.package');
    $fingerprints = config('services.android.sha256_fingerprints');

    if (! is_string($package) || $package === '' || ! is_array($fingerprints) || $fingerprints === []) {
        return response()->json([]);
    }

    return response()->json([[
        'relation' => ['delegate_permission/common.handle_all_urls'],
        'target' => [
            'namespace' => 'android_app',
            'package_name' => $package,
            'sha256_cert_fingerprints' => array_values($fingerprints),
        ],
    ]]);
})->name('well-known.assetlinks');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::post('exchange-rate/refresh', [ExchangeRateController::class, 'refresh'])->name('exchange.refresh')->middleware('throttle:6,1');

    Route::put('parameters/performance', [PerformanceSettingsController::class, 'update'])->name('parameters.performance')->middleware('can:settings.manage');
    Route::put('parameters/photos', [PhotoSettingsController::class, 'update'])->name('parameters.photos')->middleware('can:settings.manage');

    // Identidad de la empresa: logo y color.
    Route::middleware('can:settings.manage')->group(function () {
        Route::get('settings/branding', [BrandingController::class, 'edit'])->name('branding.edit');
        Route::post('settings/branding', [BrandingController::class, 'update'])->name('branding.update');
    });

    // Notificaciones internas.
    Route::prefix('notifications')->name('notifications.')->controller(NotificationController::class)->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('feed', 'feed')->name('feed');
        Route::post('/', 'store')->name('store')->middleware('can:notifications.send');
        Route::post('read-all', 'readAll')->name('readAll');
        Route::post('{announcement}/read', 'read')->name('read');
        Route::delete('{announcement}', 'destroy')->name('destroy');
    });

    // Recursos con permisos "{modulo}.view" para lectura y "{modulo}.manage" para escritura.
    $resources = [
        'users' => [UserController::class, 'users', 'user'],
        'roles' => [RoleController::class, 'roles', 'role'],
        'offices' => [OfficeController::class, 'offices', 'office'],
        'routes' => [CollectionRouteController::class, 'routes', 'route'],
        'clients' => [ClientController::class, 'clients', 'client'],
        'machines' => [MachineController::class, 'machines', 'machine'],
        'expenses' => [ExpenseController::class, 'expenses', 'expense'],
    ];

    foreach ($resources as $uri => [$controller, $permission, $parameter]) {
        Route::resource($uri, $controller)
            ->parameters([$uri => $parameter])
            ->only(['create', 'store', 'edit', 'update', 'destroy'])
            ->middleware("can:{$permission}.manage");

        Route::resource($uri, $controller)
            ->parameters([$uri => $parameter])
            ->only(method_exists($controller, 'show') ? ['index', 'show'] : ['index'])
            ->middleware("can:{$permission}.view");
    }

    // Logística de máquinas en campo.
    Route::middleware('can:machines.move')->prefix('machines/{machine}')->name('machines.')->controller(MachineMovementController::class)->group(function () {
        Route::post('transfer', 'transfer')->name('transfer');
        Route::post('warehouse', 'warehouse')->name('warehouse');
        Route::post('install', 'install')->name('install');
    });

    // Ubicación del negocio tomada en campo (quien edita clientes o registra cortes).
    Route::post('clients/{client}/location', [ClientController::class, 'updateLocation'])->name('clients.location')->middleware('can:clients.view');

    // Dirección a partir de la coordenada GPS del teléfono.
    Route::get('geocoding/reverse', [GeocodingController::class, 'reverse'])->name('geocoding.reverse')->middleware('throttle:30,1');

    // Fotos privadas del cliente, del negocio y de la máquina.
    Route::get('clients/{client}/photos/{kind}', [ClientController::class, 'photo'])->name('clients.photo')->whereIn('kind', ['client', 'business'])->middleware('can:clients.view');
    Route::get('machines/{machine}/photo', [MachineController::class, 'photo'])->name('machines.photo')->middleware('can:machines.view');

    // Modo sin conexión (antes de "collections/{collection}" para no confundirse con un id).
    Route::middleware('can:collections.create')->controller(CollectionSyncController::class)->group(function () {
        Route::get('offline', 'page')->name('offline');
        Route::get('collections/offline', 'data')->name('collections.offline');
        Route::post('collections/sync', 'store')->name('collections.sync');
    });

    Route::get('collections', [CollectionController::class, 'index'])->name('collections.index')->middleware('can:collections.view');
    Route::get('collections/create', [CollectionController::class, 'create'])->name('collections.create')->middleware('can:collections.create');
    Route::post('collections', [CollectionController::class, 'store'])->name('collections.store')->middleware('can:collections.create');
    Route::get('collections/{collection}', [CollectionController::class, 'show'])->name('collections.show')->middleware('can:collections.view');
    Route::get('collections/{collection}/receipt', [CollectionController::class, 'receipt'])->name('collections.receipt')->middleware('can:collections.view');
    Route::get('collections/{collection}/signature', [CollectionController::class, 'signature'])->name('collections.signature')->middleware('can:collections.view');
    Route::get('collections/{collection}/items/{item}/photo', [CollectionController::class, 'photo'])->name('collections.items.photo')->middleware('can:collections.view');
    Route::delete('collections/{collection}', [CollectionController::class, 'destroy'])->name('collections.destroy')->middleware('can:collections.delete');

    Route::get('loans', [LoanController::class, 'index'])->name('loans.index')->middleware('can:loans.view');
    Route::get('loans/create', [LoanController::class, 'create'])->name('loans.create')->middleware('can:loans.manage');
    Route::post('loans', [LoanController::class, 'store'])->name('loans.store')->middleware('can:loans.manage');
    Route::get('loans/{loan}', [LoanController::class, 'show'])->name('loans.show')->middleware('can:loans.view');
    Route::post('loans/{loan}/cancel', [LoanController::class, 'cancel'])->name('loans.cancel')->middleware('can:loans.manage');
    Route::post('loans/{loan}/payments', [LoanPaymentController::class, 'store'])->name('loans.payments.store')->middleware('can:loans.pay');
    Route::delete('loans/{loan}/payments/{payment}', [LoanPaymentController::class, 'destroy'])->name('loans.payments.destroy')->middleware('can:loans.manage');

    Route::middleware('can:reports.view')->prefix('reports')->name('reports.')->controller(ReportController::class)->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('daily', 'daily')->name('daily');
        Route::get('machines', 'machines')->name('machines');
        Route::get('routes', 'routes')->name('routes');
        Route::get('loans', 'loans')->name('loans');
    });
});

require __DIR__.'/settings.php';

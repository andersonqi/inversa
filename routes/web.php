<?php

use App\Http\Controllers\ClientController;
use App\Http\Controllers\CollectionController;
use App\Http\Controllers\CollectionRouteController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\LoanController;
use App\Http\Controllers\LoanPaymentController;
use App\Http\Controllers\MachineController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

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

    // Ubicación del negocio tomada en campo (quien edita clientes o registra cortes).
    Route::post('clients/{client}/location', [ClientController::class, 'updateLocation'])->name('clients.location')->middleware('can:clients.view');

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

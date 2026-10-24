<?php

use App\Services\ExchangeRateService;
use App\Services\PhotoStorage;
use App\Support\PhotoRetention;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('exchange-rate:sync', function (ExchangeRateService $service) {
    try {
        $rate = $service->refresh();
    } catch (RuntimeException $e) {
        $this->error($e->getMessage());

        return 1;
    }

    $this->info("1 USD = Q{$rate->rate} ({$rate->source}, {$rate->rate_date->toDateString()})");

    return 0;
})->purpose('Sincroniza el tipo de cambio quetzal / dólar desde Banguat');

Schedule::command('exchange-rate:sync')->hourly()->withoutOverlapping();

Artisan::command('photos:prune {--days= : Días a conservar (por defecto, el plazo configurado en Empresa)}', function (PhotoStorage $photos) {
    $option = $this->option('days');
    $days = is_numeric($option) ? max(PhotoRetention::MIN_DAYS, (int) $option) : PhotoRetention::current()->days;

    $pruned = $photos->pruneCounterPhotos($days);

    $this->info("Fotos de contadores eliminadas: {$pruned} (cortes con más de {$days} días).");

    return 0;
})->purpose('Elimina las fotos de contadores de los cortes más antiguos que el plazo configurado');

Schedule::command('photos:prune')->dailyAt('03:00')->withoutOverlapping();

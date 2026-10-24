<?php

use App\Services\ExchangeRateService;
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

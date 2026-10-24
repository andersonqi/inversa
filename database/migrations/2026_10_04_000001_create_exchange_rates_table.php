<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tipo de cambio de referencia (quetzales por dólar) consultado a fuentes externas.
 * Un registro por día y fuente; se actualiza en cada sincronización.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->string('currency', 3)->default('USD');
            // Quetzales por 1 unidad de la moneda.
            $table->decimal('rate', 12, 6);
            $table->date('rate_date');
            $table->string('source');
            $table->timestamp('fetched_at');
            $table->timestamps();

            $table->unique(['currency', 'rate_date', 'source']);
            $table->index('fetched_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exchange_rates');
    }
};

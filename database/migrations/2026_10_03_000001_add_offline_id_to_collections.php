<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identificador generado en el teléfono para cortes registrados sin conexión: evita
 * duplicarlos si la sincronización se reintenta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->uuid('offline_id')->nullable()->unique()->after('signature_path');
        });
    }

    public function down(): void
    {
        Schema::table('collections', fn (Blueprint $table) => $table->dropColumn('offline_id'));
    }
};
